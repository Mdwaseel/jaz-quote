import { useState } from 'react';
import { Box, Typography, Chip, IconButton, Collapse, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const ROLE_COLOR = { Admin: 'secondary', Director: 'secondary', RSD: 'primary', RM: 'primary', 'Sr. BDM': 'default', BDM: 'default' };

function Node({ node, depth, renderMeta, renderActions }) {
  const [open, setOpen] = useState(depth < 3);
  const kids = node.Children || [];
  return (
    <Box>
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1 }, py: 0.75, pr: 1,
          borderRadius: 1, opacity: node.Active === false ? 0.55 : 1,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <IconButton size="small" onClick={() => setOpen((o) => !o)} disabled={!kids.length}
          aria-label={open ? 'Collapse' : 'Expand'} sx={{ visibility: kids.length ? 'visible' : 'hidden' }}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Chip size="small" label={node.Role} color={ROLE_COLOR[node.Role] || 'default'} variant={['Admin', 'Director'].includes(node.Role) ? 'filled' : 'outlined'} sx={{ minWidth: { sm: 72 }, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {node.Name}
            {node.Region && <Typography component="span" variant="body2" color="text.secondary"> · {node.Region}</Typography>}
            {node.Active === false && <Typography component="span" variant="caption" color="error.main"> · inactive</Typography>}
          </Typography>
          {renderMeta && <Typography variant="caption" color="text.secondary" noWrap component="div">{renderMeta(node)}</Typography>}
        </Box>
        {renderActions && <Stack direction="row" spacing={0.5}>{renderActions(node)}</Stack>}
      </Box>
      {kids.length > 0 && (
        <Collapse in={open}>
          <Box sx={{ borderLeft: '1.5px solid', borderColor: 'divider', ml: '15px', pl: { xs: 0.5, sm: 1.5 } }}>
            {kids.map((k) => (
              <Node key={k.Id} node={k} depth={depth + 1} renderMeta={renderMeta} renderActions={renderActions} />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

// `nodes`: [{Id, Name, Role, Region, Active, Children: [...]}]
export default function OrgTree({ nodes = [], renderMeta, renderActions }) {
  return (
    <Box role="tree">
      {nodes.map((n) => <Node key={n.Id} node={n} depth={0} renderMeta={renderMeta} renderActions={renderActions} />)}
    </Box>
  );
}
