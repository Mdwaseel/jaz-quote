import { Dialog, DialogTitle, DialogContent, Box, Button, IconButton, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';

/**
 * Shows a generated quotation PDF inline (exactly how it downloads) with a
 * Download button. `url` is an object URL of the PDF blob.
 */
export default function PdfPreviewDialog({ open, onClose, url, filename = 'quotation.pdf', loading, error, title = 'Quotation Preview' }) {
  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, py: 1.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={download} disabled={!url}>
            Download
          </Button>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#525659', display: 'flex' }}>
        {loading ? (
          <Box sx={{ m: 'auto', textAlign: 'center', color: '#fff' }}>
            <CircularProgress color="inherit" />
            <Typography variant="body2" sx={{ mt: 2 }}>Generating preview…</Typography>
          </Box>
        ) : error ? (
          <Box sx={{ m: 'auto', textAlign: 'center', color: '#fff', px: 3 }}>
            <Typography variant="body1">{error}</Typography>
          </Box>
        ) : url ? (
          <iframe title="Quotation PDF" src={url} style={{ width: '100%', height: '100%', border: 'none' }} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
