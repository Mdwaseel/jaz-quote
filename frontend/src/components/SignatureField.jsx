import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Tabs, Tab, Alert, Stack } from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import SignaturePad from './SignaturePad';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_INPUT = 10 * 1024 * 1024; // raw file; it is resized before saving
const MAX_W = 900;
const MAX_H = 300;
const TARGET_BYTES = 550 * 1024; // server limit is 600 KB

const dataUrlBytes = (url) => Math.ceil(((url.split(',')[1] || '').length * 3) / 4);

// Resize an uploaded image to signature size; fall back to JPEG if the PNG is too big.
const toSignature = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the file.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a readable image.'));
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL('image/png');
      if (dataUrlBytes(out) > TARGET_BYTES) {
        // Photos: flatten onto white and use JPEG.
        const flat = document.createElement('canvas');
        flat.width = canvas.width;
        flat.height = canvas.height;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = '#fff';
        fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(canvas, 0, 0);
        out = flat.toDataURL('image/jpeg', 0.85);
      }
      if (dataUrlBytes(out) > TARGET_BYTES) reject(new Error('That image is too detailed — please crop it to just the signature.'));
      else resolve(out);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/**
 * Signature input: draw it, or upload a photo/scan of a signed paper.
 * `value` is a data URL ('' when empty); `onChange(dataUrl)`.
 */
export default function SignatureField({ label, value, onChange, height = 140 }) {
  const [mode, setMode] = useState('draw');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  // Editing = showing the pad / upload box. A saved signature (even one that loads
  // after mount, e.g. when editing a quotation) shows as a preview until replaced.
  const [editing, setEditing] = useState(!value);
  const touched = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value && !touched.current) setEditing(false);
  }, [value]);

  const draw = (v) => { touched.current = true; onChange(v); };

  const handleFile = async (file) => {
    setError('');
    if (!file) return;
    if (!TYPES.includes(file.type)) { setError('Please choose a PNG, JPG or WebP image.'); return; }
    if (file.size > MAX_INPUT) { setError('That file is larger than 10 MB.'); return; }
    try {
      touched.current = true;
      onChange(await toSignature(file));
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{label}</Typography>
      {value && !editing ? (
        <Box>
          <Box sx={{
            height, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fafbfc',
            display: 'grid', placeItems: 'center', p: 1
          }}>
            <Box component="img" src={value} alt={label} sx={{ maxWidth: '100%', maxHeight: height - 16, objectFit: 'contain' }} />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
            <Button size="small" onClick={() => { touched.current = true; setEditing(true); onChange(''); }}>Replace</Button>
            <Button size="small" color="error" onClick={() => { touched.current = true; setEditing(true); onChange(''); }}>Remove</Button>
          </Stack>
        </Box>
      ) : (
        <>
          <Tabs value={mode} onChange={(_, v) => { setMode(v); setError(''); }} sx={{ minHeight: 36, mb: 1, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
            <Tab value="draw" label="Draw" />
            <Tab value="upload" label="Upload image" />
          </Tabs>
          {mode === 'draw' ? (
            <SignaturePad label="" onChange={draw} height={height} />
          ) : (
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
              sx={{
                height, border: '1.5px dashed', borderColor: dragOver ? 'primary.main' : 'divider', borderRadius: 1,
                bgcolor: dragOver ? 'primary.light' : '#fafbfc', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1, textAlign: 'center', px: 2
              }}
            >
              <Button variant="outlined" size="small" startIcon={<UploadFileOutlinedIcon />} onClick={() => inputRef.current?.click()}>
                Choose image
              </Button>
              <Typography variant="caption" color="text.secondary">
                or drag it here · a photo or scan of the signed paper · PNG, JPG or WebP
              </Typography>
              <input ref={inputRef} type="file" accept={TYPES.join(',')} hidden
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
            </Box>
          )}
          {error && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert>}
        </>
      )}
    </Box>
  );
}
