"use client";

import ExpandMore from "@mui/icons-material/ExpandMore";
import OpenInNew from "@mui/icons-material/OpenInNew";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type FormEvent, useState } from "react";

import { formatDateTime } from "@/lib/delivery/format";
import { addCustomerShipment } from "@/lib/delivery/operations-actions";
import { useOperationsWorkspace } from "@/lib/delivery/use-operations-workspace";
import { createClient } from "@/lib/supabase/client";

export function CustomerProviderTracking() {
  const workspace = useOperationsWorkspace("customer");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(action: () => Promise<void>, message: string) {
    if (workspace.isDemo) {
      setNotice("Sign in to add provider tracking to your account.");
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      await action();
      await workspace.refresh();
      setNotice(message);
      return true;
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not save this shipment.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = workspace.profile;
    if (!profile) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await save(
      () =>
        addCustomerShipment(createClient(), {
          customerId: profile.id,
          providerName: String(form.get("provider")),
          trackingCode: String(form.get("tracking")),
          trackingUrl: String(form.get("trackingUrl") || ""),
        }),
      "Provider shipment added.",
    );
    if (saved) formElement.reset();
  }

  const fieldSx = { bgcolor: "background.paper" } as const;
  const shipmentCount = workspace.data.externalShipments.length;

  // Carrier tracking is saved to an account; guests get the sign-in prompt
  // above instead of forms that can't submit.
  if (!workspace.isAuthenticated && !workspace.isDemo) return null;

  return (
    <Box
      component="section"
      aria-labelledby="providers-title"
      sx={{ mx: 2, mt: 3, pb: 3 }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: "center", minHeight: 40, mb: 0.5 }}
      >
        <Typography
          id="providers-title"
          variant="subtitle1"
          component="h2"
          sx={{ fontWeight: 750, flex: 1 }}
        >
          Other carriers
        </Typography>
        {shipmentCount > 0 && (
          <Chip
            size="small"
            label={`${shipmentCount} followed`}
            sx={{ bgcolor: "grey.100", fontWeight: 650 }}
          />
        )}
      </Stack>
      {notice && (
        <Alert
          component="output"
          icon={false}
          severity="info"
          sx={{ borderRadius: "12px", mb: 1 }}
        >
          {notice}
        </Alert>
      )}

      {workspace.data.externalShipments.length > 0 ? (
        <List
          disablePadding
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 1,
          }}
        >
          {workspace.data.externalShipments.map((shipment) => (
            <ListItem
              key={shipment.id}
              sx={{
                gap: 1.5,
                minHeight: 64,
                px: 1.5,
                borderRadius: "16px",
                bgcolor: "grey.100",
              }}
              secondaryAction={
                shipment.tracking_url ? (
                  <IconButton
                    component="a"
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${shipment.provider_name} tracking`}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                ) : undefined
              }
            >
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: "background.paper",
                  color: "secondary.main",
                  fontSize: 14,
                  fontWeight: 750,
                }}
              >
                {shipment.provider_name.slice(0, 2).toUpperCase()}
              </Avatar>
              <ListItemText
                sx={{ m: 0, minWidth: 0 }}
                primary={shipment.tracking_code}
                secondary={`${shipment.provider_name} · ${shipment.status.replace("_", " ")} · ${formatDateTime(shipment.latest_event_at || shipment.updated_at)}`}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: { fontWeight: 700, fontSize: 14 },
                  },
                  secondary: { noWrap: true, sx: { fontSize: 12 } },
                }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" sx={{ color: "text.secondary", px: 0.5 }}>
          Add a tracking code from another carrier to follow it here.
        </Typography>
      )}

      <Box
        sx={{
          mt: 1.5,
          borderRadius: "16px",
          bgcolor: "grey.100",
          overflow: "hidden",
        }}
      >
        <Accordion
          disableGutters
          elevation={0}
          sx={{ bgcolor: "transparent", "&::before": { display: "none" } }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ minHeight: 56, px: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Add a parcel from another carrier
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Stack component="form" spacing={1.5} onSubmit={addShipment}>
              <TextField
                name="provider"
                label="Carrier or store"
                required
                size="small"
                sx={fieldSx}
              />
              <TextField
                name="tracking"
                label="Tracking code"
                required
                size="small"
                sx={fieldSx}
                slotProps={{
                  htmlInput: {
                    autoCapitalize: "characters",
                    autoComplete: "off",
                    spellCheck: false,
                  },
                }}
              />
              <TextField
                name="trackingUrl"
                label="Tracking link (optional)"
                type="url"
                size="small"
                sx={fieldSx}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={saving || !workspace.isAuthenticated}
                sx={{ minHeight: 44 }}
              >
                Add tracking
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
}
