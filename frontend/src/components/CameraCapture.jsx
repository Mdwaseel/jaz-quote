import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Alert, Typography, CircularProgress } from '@mui/material';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import CameraswitchOutlinedIcon from '@mui/icons-material/CameraswitchOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';

const MAX_SIDE = 1280;

const cameraError = (e) => {
  if (!window.isSecureContext) return 'The camera needs a secure (https) connection.';
  if (e?.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.';
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (e?.name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'The camera could not be started. Please try again.';
};

/**
 * Live photo capture — the only way to provide a photo (there is deliberately no
 * file upload). `onChange(dataUrl | '')` receives a JPEG data URL.
 */
export default function CameraCapture({ value, onChange, facing = 'user', height = 320 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState(facing);
  const [state, setState] = useState('idle'); // idle | starting | live | error
  const [error, setError] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (facingMode) => {
    stop();
    setError('');
    setState('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(cameraError());
      setState('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('live');
    } catch (e) {
      setError(cameraError(e));
      setState('error');
    }
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/jpeg', 0.85));
    stop();
    setState('idle');
  };

  const retake = () => { onChange(''); start(mode); };
  const flip = () => { const next = mode === 'user' ? 'environment' : 'user'; setMode(next); start(next); };

  return (
    <Box>
      <Box sx={{
        position: 'relative', height, borderRadius: 2, overflow: 'hidden', bgcolor: '#0f2740',
        display: 'grid', placeItems: 'center'
      }}>
        {value ? (
          <Box component="img" src={value} alt="Captured photo" sx={{ width: '100%', height: '100%', objectFit: 'contain', bgcolor: '#000' }} />
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay style={{
              width: '100%', height: '100%', objectFit: 'cover', display: state === 'live' ? 'block' : 'none',
              transform: mode === 'user' ? 'scaleX(-1)' : 'none'
            }} />
            {state === 'starting' && <CircularProgress sx={{ color: '#fff' }} />}
            {state === 'idle' && (
              <Stack alignItems="center" spacing={1.5} sx={{ color: '#fff', px: 3, textAlign: 'center' }}>
                <PhotoCameraOutlinedIcon sx={{ fontSize: 44, opacity: 0.85 }} />
                <Typography variant="body2" sx={{ color: '#cdd9e5' }}>Your browser will ask for permission to use the camera.</Typography>
                <Button variant="contained" color="secondary" onClick={() => start(mode)}>Open camera</Button>
              </Stack>
            )}
          </>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mt: 1.5 }} action={<Button color="inherit" size="small" onClick={() => start(mode)}>Try again</Button>}>{error}</Alert>}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
        {value ? (
          <Button startIcon={<ReplayOutlinedIcon />} onClick={retake}>Retake photo</Button>
        ) : state === 'live' && (
          <>
            <Button variant="contained" startIcon={<PhotoCameraOutlinedIcon />} onClick={capture}>Take photo</Button>
            <Button startIcon={<CameraswitchOutlinedIcon />} onClick={flip}>Switch camera</Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
