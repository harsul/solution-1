import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

/** Narrow centered card shared by the sign-in and register pages. */
export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ maxWidth: 420, mx: 'auto' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
