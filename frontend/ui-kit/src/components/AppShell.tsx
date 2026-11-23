// 画面の枠（ヘッダーとメニュー。BR1.3 のログアウト）
import { useState, type ReactNode } from 'react';
import { AppBar, Box, IconButton, Menu, MenuItem, Toolbar, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

export interface AppShellMenuItem {
  label: string;
  onClick: () => void;
  testId: string;
}

export interface AppShellProps {
  title: string;
  menuItems: AppShellMenuItem[];
  children: ReactNode;
}

export function AppShell({ title, menuItems, children }: AppShellProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography component="div" variant="h6" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <IconButton
            color="inherit"
            aria-label="メニュー"
            onClick={(e) => setAnchor(e.currentTarget)}
            data-testid="menu-button"
            size="large"
          >
            <MenuIcon />
          </IconButton>
          <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
            {menuItems.map((item) => (
              <MenuItem
                key={item.testId}
                onClick={() => {
                  setAnchor(null);
                  item.onClick();
                }}
                data-testid={item.testId}
              >
                {item.label}
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 2, maxWidth: 960, mx: 'auto' }}>
        {children}
      </Box>
    </Box>
  );
}
