"use client";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import { CustomerSheet as Sheet } from "@/components/delivery/customer-sheet";
import { StatusChip } from "@/components/delivery/customer-ui-utils";
import { currency } from "@/lib/delivery/format";
import type { DeliveryOrder } from "@/lib/delivery/types";

export type CodSheetProps = {
  open: boolean;
  orders: DeliveryOrder[];
  onClose: () => void;
};

export function CodSheet({ open, orders, onClose }: CodSheetProps) {
  const total = orders.reduce((sum, order) => sum + order.cod_amount, 0);
  return (
    <Sheet open={open} onClose={onClose} titleId="cod-title" title="COD due">
      {orders.length === 0 ? (
        <Typography sx={{ pb: 2, color: "text.secondary" }}>
          No cash payments are due right now.
        </Typography>
      ) : (
        <>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 1.5,
              borderRadius: "16px",
              bgcolor: "warning.light",
            }}
          >
            <Typography variant="body2" sx={{ color: "warning.dark" }}>
              Total payable on delivery
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 750, color: "warning.dark" }}
            >
              {currency.format(total)}
            </Typography>
            <Typography variant="caption" sx={{ color: "warning.dark" }}>
              Pay your rider when each parcel arrives.
            </Typography>
          </Paper>
          <List
            disablePadding
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 1,
              pb: "calc(20px + env(safe-area-inset-bottom))",
            }}
          >
            {orders.map((order) => (
              <ListItem disablePadding key={order.id}>
                <ListItemButton
                  component={Link}
                  href={`/track?order=${encodeURIComponent(order.id)}`}
                  onClick={onClose}
                  sx={{
                    gap: 1.5,
                    minHeight: 64,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: "16px",
                  }}
                >
                  <ListItemText
                    primary={order.tracking_code}
                    secondary={currency.format(order.cod_amount)}
                    slotProps={{
                      primary: { sx: { fontWeight: 700, fontSize: 14 } },
                      secondary: { sx: { fontSize: 13 } },
                    }}
                    sx={{ m: 0 }}
                  />
                  <StatusChip status={order.status} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Sheet>
  );
}
