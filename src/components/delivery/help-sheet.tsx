"use client";

import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import OutlinedInput from "@mui/material/OutlinedInput";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { CustomerSheet as Sheet } from "@/components/delivery/customer-sheet";
import { createSupportCase } from "@/lib/delivery/operations-actions";
import type { DeliveryOrder } from "@/lib/delivery/types";
import { createClient } from "@/lib/supabase/client";

export const faqs = [
  {
    q: "Why can’t I see my rider’s location?",
    a: "Live location starts after your rider collects the parcel. If the signal drops, the map shows the last known point.",
  },
  {
    q: "What if I miss the delivery?",
    a: "The parcel is marked “Delivery issue” and you’ll see it under Notifications. Open the parcel for the latest status.",
  },
  {
    q: "How does cash on delivery work?",
    a: "Have the exact amount ready. Your rider records the payment when they hand over the parcel.",
  },
];

export const HELP_TOPICS = [
  "Late or missing parcel",
  "Wrong address or landmark",
  "Damaged parcel",
  "Cash on delivery",
  "Something else",
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export type HelpSheetProps = {
  open: boolean;
  order: DeliveryOrder | null;
  /** The customer's own parcels, offered as a picker when no parcel is selected. */
  orders?: DeliveryOrder[];
  /** Signed-in customer's id; requests need an account to follow up on. */
  requesterId: string | null;
  /** Off on the parcel's own Track page, where the status is already shown. */
  showStatusLink?: boolean;
  onSignIn: () => void;
  onClose: () => void;
};

/**
 * One place for help: quick fixes first (call the rider, check status), then
 * a request that reaches the support team's case queue with the parcel
 * attached, so nobody has to retype the tracking code.
 */
export function HelpSheet({
  open,
  order: orderProp,
  orders = [],
  requesterId,
  showStatusLink = true,
  onSignIn,
  onClose,
}: HelpSheetProps) {
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  // With no parcel in context, ask which one (or none) before the form.
  const [picked, setPicked] = useState<string | null>(null);
  const needsPicker = !orderProp && orders.length > 0;
  const order =
    orderProp ??
    (picked && picked !== "none"
      ? (orders.find((item) => item.id === picked) ?? null)
      : null);
  const realOrder = order && !order.id.startsWith("demo-") ? order : null;
  const canCall =
    !!order?.driver_phone &&
    !!order.driver_id &&
    !["delivered", "failed", "cancelled"].includes(order.status);

  function close() {
    if (state === "sent") {
      setTopic(null);
      setDetails("");
      setPicked(null);
      setState("idle");
    }
    setError(null);
    onClose();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requesterId || !topic || !details.trim()) return;
    setState("sending");
    setError(null);
    try {
      await createSupportCase(createClient(), {
        requesterId,
        orderId: realOrder?.id,
        subject: realOrder ? `${topic} · ${realOrder.tracking_code}` : topic,
        description: details,
        priority: topic === "Late or missing parcel" ? "high" : "normal",
      });
      setState("sent");
    } catch (cause) {
      setState("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t send your request. Try again.",
      );
    }
  }

  const rowSx = {
    minHeight: 60,
    gap: 1.5,
    border: 1,
    borderColor: "divider",
    borderRadius: "16px",
  } as const;

  return (
    <Sheet open={open} onClose={close} titleId="help-title" title="Get help">
      {needsPicker && (
        <Box component="section" sx={{ mb: 2 }}>
          <Typography
            variant="subtitle1"
            component="h3"
            id="help-parcel-label"
            sx={{ fontWeight: 750 }}
          >
            Which parcel is this about?
          </Typography>
          <List
            disablePadding
            role="radiogroup"
            aria-labelledby="help-parcel-label"
            sx={{ display: "grid", gap: 1, mt: 1 }}
          >
            {[
              ...orders.slice(0, 5).map((item) => ({
                id: item.id,
                title: item.tracking_code,
                detail: item.delivery_address,
              })),
              { id: "none", title: "Not about a parcel", detail: "" },
            ].map((item) => {
              const selected = picked === item.id;
              return (
                <ListItem disablePadding key={item.id}>
                  <ListItemButton
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPicked(item.id)}
                    sx={{
                      ...rowSx,
                      minHeight: 56,
                      borderColor: selected ? "secondary.main" : "divider",
                      bgcolor: selected ? "action.selected" : undefined,
                    }}
                  >
                    {selected ? (
                      <CheckCircleOutlined color="secondary" />
                    ) : (
                      <Box sx={{ width: 24, height: 24, flex: "none" }} />
                    )}
                    <ListItemText
                      primary={item.title}
                      secondary={item.detail || undefined}
                      slotProps={{
                        primary: { sx: { fontWeight: 700 } },
                        secondary: { sx: { overflowWrap: "anywhere" } },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
      {order && (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          About parcel <strong>{order.tracking_code}</strong>
        </Typography>
      )}
      {(canCall || (order && showStatusLink)) && (
        <List
          disablePadding
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 1,
            mb: 2,
          }}
        >
          {canCall && order?.driver_phone && (
            <ListItem disablePadding>
              <ListItemButton
                component="a"
                href={`tel:${order.driver_phone}`}
                sx={rowSx}
              >
                <PhoneOutlined />
                <ListItemText
                  primary="Call your rider"
                  secondary={order.driver_name ?? "Assigned rider"}
                  slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                />
              </ListItemButton>
            </ListItem>
          )}
          {order && showStatusLink && (
            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                href={`/track?order=${encodeURIComponent(order.id)}`}
                onClick={close}
                sx={rowSx}
              >
                <TrackChangesOutlined />
                <ListItemText
                  primary="Check the latest status"
                  secondary="Timeline, estimate and rider location"
                  slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      )}

      {state === "sent" ? (
        <Alert
          severity="success"
          icon={<CheckCircleOutlined />}
          sx={{ borderRadius: "12px" }}
        >
          Request sent. Our support team will follow up on your account
          {realOrder ? ` about ${realOrder.tracking_code}` : ""}.
        </Alert>
      ) : (
        <Box component="form" onSubmit={send}>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{ fontWeight: 750 }}
          >
            Contact support
          </Typography>
          <Stack
            direction="row"
            role="radiogroup"
            aria-label="What’s the problem?"
            sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}
          >
            {HELP_TOPICS.map((item) => {
              const selected = topic === item;
              return (
                <Chip
                  key={item}
                  role="radio"
                  aria-checked={selected}
                  clickable
                  label={item}
                  onClick={() => setTopic(item)}
                  icon={selected ? <CheckCircleOutlined /> : undefined}
                  sx={{
                    height: 40,
                    borderRadius: "999px",
                    fontWeight: 650,
                    bgcolor: selected ? "secondary.main" : "grey.100",
                    color: selected ? "secondary.contrastText" : "text.primary",
                    "& .MuiChip-icon": { color: "inherit" },
                    "&:hover": {
                      bgcolor: selected ? "secondary.main" : "grey.200",
                    },
                  }}
                />
              );
            })}
          </Stack>
          <OutlinedInput
            fullWidth
            multiline
            minRows={3}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="What happened? Add anything the rider or support should know."
            inputProps={{
              "aria-label": "Describe the problem",
              maxLength: 1000,
            }}
            sx={{ mt: 1.5, bgcolor: "background.paper" }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: "12px" }}>
              {error}
            </Alert>
          )}
          {requesterId ? (
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={
                !topic ||
                !details.trim() ||
                state === "sending" ||
                (needsPicker && picked === null)
              }
              sx={{ mt: 1.5, minHeight: 52 }}
            >
              {state === "sending" ? "Sending…" : "Send to support"}
            </Button>
          ) : (
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              size="large"
              onClick={onSignIn}
              sx={{ mt: 1.5, minHeight: 52 }}
            >
              Sign in to contact support
            </Button>
          )}
        </Box>
      )}

      <Box sx={{ mt: 2.5, borderTop: 1, borderColor: "divider" }}>
        {faqs.map((faq) => (
          <Accordion
            key={faq.q}
            disableGutters
            square
            elevation={0}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ minHeight: 48, px: 0 }}
            >
              <Typography sx={{ fontWeight: 600 }}>{faq.q}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 0 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {faq.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Sheet>
  );
}
