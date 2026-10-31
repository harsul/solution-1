import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { passwordRules } from './passwordRules';

/** Hidden on screen but read by screen readers (incl. via the field's aria-describedby). */
const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

/**
 * Live checklist of the password rules under the password field. Each rule's state is part of
 * its text (visually hidden), so the field's description tells screen readers which rules fail.
 */
export default function PasswordRuleList({ password, id }: { password: string; id: string }) {
  return (
    <List id={id} dense disablePadding sx={{ mt: -1 }}>
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        return (
          <ListItem key={rule.id} disableGutters sx={{ py: 0 }}>
            <ListItemIcon sx={{ minWidth: 28 }} aria-hidden="true">
              {met ? (
                <CheckCircleIcon fontSize="small" color="success" />
              ) : (
                <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <>
                  {rule.label}
                  <Box component="span" sx={srOnly}>
                    {met ? ': met.' : ': not met.'}
                  </Box>
                </>
              }
              slotProps={{ primary: { variant: 'body2', color: met ? 'text.primary' : 'text.secondary' } }}
            />
          </ListItem>
        );
      })}
    </List>
  );
}
