import { Card, CardHeader, CardContent, Divider, Typography, Box } from '@mui/material';

export default function MainCard({ title, secondary, children, sx, contentSx }) {
  return (
    <Card sx={{ border: '1px solid', borderColor: 'divider', ...sx }}>
      {title && (
        <>
          <CardHeader
            title={
              typeof title === 'string' ? (
                <Typography variant="h3">{title}</Typography>
              ) : (
                title
              )
            }
            action={secondary}
            sx={{ py: 2 }}
          />
          <Divider />
        </>
      )}
      <CardContent sx={{ ...contentSx }}>{children ?? <Box />}</CardContent>
    </Card>
  );
}
