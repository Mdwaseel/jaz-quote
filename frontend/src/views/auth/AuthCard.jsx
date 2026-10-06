import { Card, CardContent } from '@mui/material';

// The logo sits above the card on the cinema backdrop (see CinemaBackdrop).
export default function AuthCard({ children }) {
  return (
    <Card sx={{ width: '100%', maxWidth: 440, border: 'none', boxShadow: '0 30px 70px -24px rgba(0,0,0,.7)' }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        {children}
      </CardContent>
    </Card>
  );
}
