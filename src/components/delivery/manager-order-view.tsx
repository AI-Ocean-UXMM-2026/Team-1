"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputAdornment from "@mui/material/InputAdornment";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import { alpha } from "@mui/material/styles";

import SearchRounded from "@mui/icons-material/SearchRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import LocalGasStationOutlined from "@mui/icons-material/LocalGasStationOutlined";
import WarningAmber from "@mui/icons-material/WarningAmber";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import ArrowBack from "@mui/icons-material/ArrowBack";
import CheckRounded from "@mui/icons-material/CheckRounded";

import { LocationMap } from "@/components/delivery/location-map";
import { assessEnergyRoute } from "@/lib/delivery/energy-routing";
import { confirmOrders } from "@/lib/delivery/jobs";
import { useJobBoard } from "@/lib/delivery/use-job-board";
import { createClient } from "@/lib/supabase/client";
import { currency, formatTime, sentenceCase } from "@/lib/delivery/format";
import {
  isMovingOrder,
  needsRider,
  codPending,
} from "@/lib/delivery/dashboard";
import type {
  DeliveryOrder,
  DeliveryStatus,
  VehicleOption,
} from "@/lib/delivery/types";
import type { useWorkspace } from "@/lib/delivery/use-workspace";
import Link from "next/link";
import "./manager-order-view.css";

type Workspace = ReturnType<typeof useWorkspace>;

type FilterTab = "all" | "unassigned" | "moving" | "cod" | "delivered";

interface ManagerOrderViewProps {
  workspace: Workspace;
  orders: DeliveryOrder[];
  movingOrders: DeliveryOrder[];
  movingCount: number;
  initialSelectedId?: string | null;
}

export function ManagerOrderView({
  workspace,
  orders,
  movingOrders,
  movingCount,
  initialSelectedId,
}: ManagerOrderViewProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || orders[0]?.id || "",
  );
  const [confirmedOrderIds, setConfirmedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [mobileTab, setMobileTab] = useState<"list" | "detail">("list");
  const board = useJobBoard(workspace.canUseLiveData && !workspace.isDemo);
  const confirmedIds = useMemo(() => {
    const ids = new Set(confirmedOrderIds);
    for (const id of board.queuedIds) ids.add(id);
    return ids;
  }, [confirmedOrderIds, board.queuedIds]);

  // Filtering orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filter === "unassigned")
        return (
          needsRider(order) &&
          order.status !== "delivered" &&
          !confirmedIds.has(order.id)
        );
      if (filter === "moving") return isMovingOrder(order);
      if (filter === "cod") return codPending(order);
      if (filter === "delivered") return order.status === "delivered";
      return true;
    });
  }, [orders, filter, confirmedIds]);

  // Searching orders
  const searchedOrders = useMemo(() => {
    if (!searchQuery.trim()) return filteredOrders;
    const q = searchQuery.trim().toLowerCase();
    return filteredOrders.filter(
      (order) =>
        order.tracking_code.toLowerCase().includes(q) ||
        order.customer_name.toLowerCase().includes(q) ||
        order.delivery_address.toLowerCase().includes(q) ||
        order.pickup_address.toLowerCase().includes(q) ||
        (order.driver_name && order.driver_name.toLowerCase().includes(q)),
    );
  }, [filteredOrders, searchQuery]);

  // Selected order resolution
  const selectedOrder = useMemo(() => {
    return (
      searchedOrders.find((o) => o.id === selectedId) ??
      filteredOrders.find((o) => o.id === selectedId) ??
      orders.find((o) => o.id === selectedId) ??
      searchedOrders[0] ??
      filteredOrders[0] ??
      orders[0] ??
      null
    );
  }, [searchedOrders, filteredOrders, orders, selectedId]);

  // Route Energy Assessment
  const assessment = useMemo(() => {
    if (!selectedOrder) return null;
    const vehicle = selectedOrder.vehicle_id
      ? workspace.data.vehicles.find((v) => v.id === selectedOrder.vehicle_id)
      : (workspace.data.vehicles[0] ?? null);
    return assessEnergyRoute(
      { ...selectedOrder, latest_location: null },
      vehicle as VehicleOption | null,
    );
  }, [selectedOrder, workspace.data.vehicles]);

  // Check if order is confirmed
  const isOrderConfirmed = (order: DeliveryOrder) => {
    return order.status !== "pending" || confirmedIds.has(order.id);
  };

  // Order confirmation handler
  async function handleConfirmOrder(order: DeliveryOrder) {
    if (isOrderConfirmed(order) || savingId === order.id) return;
    setSavingId(order.id);
    setNotice(null);

    try {
      if (workspace.isDemo || order.id.startsWith("demo-")) {
        // Immediate local state update for demo
        workspace.updateData((previous) => ({
          ...previous,
          orders: previous.orders.map((o) =>
            o.id === order.id
              ? { ...o, status: "assigned" as DeliveryStatus }
              : o,
          ),
        }));
        setConfirmedOrderIds((prev) => new Set(prev).add(order.id));
        setNotice({
          tone: "success",
          text: `Delivery ${order.tracking_code} confirmed! Automatically dispatched to driver job board.`,
        });
        return;
      }

      if (!workspace.canUseLiveData || !workspace.profile) {
        throw new Error("Manager access required to confirm live orders.");
      }

      const result = await confirmOrders(createClient(), [order.id]);
      setConfirmedOrderIds((prev) => new Set(prev).add(order.id));
      await workspace.refresh();
      setNotice({
        tone: "success",
        text: result.confirmed
          ? `Delivery ${order.tracking_code} confirmed! Queued on driver job board.`
          : `Delivery ${order.tracking_code} is already queued on the job board.`,
      });
    } catch (cause) {
      setNotice({
        tone: "error",
        text:
          cause instanceof Error
            ? cause.message
            : "Could not confirm delivery.",
      });
    } finally {
      setSavingId(null);
    }
  }

  const copyTracking = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Status Badge Helper
  const renderStatusChip = (status: DeliveryStatus, orderId: string) => {
    const onBoard = confirmedIds.has(orderId) && status === "pending";
    const activeStatus = onBoard ? "assigned" : status;

    switch (activeStatus) {
      case "pending":
        return (
          <Chip
            size="small"
            label="Pending Confirm"
            sx={{
              bgcolor: "#fef3c7",
              color: "#92400e",
              fontWeight: 650,
              fontSize: "11px",
              border: "1px solid #fde68a",
              height: 24,
            }}
          />
        );
      case "assigned":
        return (
          <Chip
            size="small"
            icon={
              <CheckRounded
                sx={{
                  fontSize: "14px !important",
                  color: "#166534 !important",
                }}
              />
            }
            label={onBoard ? "On job board" : "Confirmed"}
            sx={{
              bgcolor: "#dcfce7",
              color: "#166534",
              fontWeight: 650,
              fontSize: "11px",
              border: "1px solid #bbf7d0",
              height: 24,
            }}
          />
        );
      case "in_transit":
      case "picked_up":
        return (
          <Chip
            size="small"
            label="On Route"
            sx={{
              bgcolor: "#dbeafe",
              color: "#1e40af",
              fontWeight: 650,
              fontSize: "11px",
              border: "1px solid #bfdbfe",
              height: 24,
            }}
          />
        );
      case "delivered":
        return (
          <Chip
            size="small"
            label="Delivered"
            sx={{
              bgcolor: "#f0fdf4",
              color: "#15803d",
              fontWeight: 650,
              fontSize: "11px",
              border: "1px solid #86efac",
              height: 24,
            }}
          />
        );
      default:
        return (
          <Chip
            size="small"
            label={sentenceCase(activeStatus)}
            sx={{
              bgcolor: "#f1f5f9",
              color: "#475569",
              fontWeight: 600,
              fontSize: "11px",
              height: 24,
            }}
          />
        );
    }
  };

  const toConfirmCount = orders.filter(
    (o) => o.status === "pending" && !confirmedIds.has(o.id),
  ).length;
  const movingTabCount = orders.filter(isMovingOrder).length;
  const codTabCount = orders.filter(codPending).length;
  const deliveredTabCount = orders.filter(
    (o) => o.status === "delivered",
  ).length;

  return (
    <Box className="manager-order-view-container">
      {/* Mobile view toggle tabs */}
      <Box
        className="manager-order-mobile-tabs"
        sx={{ display: { xs: "flex", md: "none" } }}
      >
        <Button
          fullWidth
          variant={mobileTab === "list" ? "contained" : "outlined"}
          onClick={() => setMobileTab("list")}
          startIcon={<LocalShippingOutlined />}
          sx={{
            py: 1,
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "13px",
            bgcolor: mobileTab === "list" ? "#1e293b" : "#ffffff",
            color: mobileTab === "list" ? "#ffffff" : "#475569",
            borderColor: "#cbd5e1",
          }}
        >
          Queue ({searchedOrders.length})
        </Button>
        <Button
          fullWidth
          variant={mobileTab === "detail" ? "contained" : "outlined"}
          onClick={() => setMobileTab("detail")}
          startIcon={<LocationOnOutlined />}
          disabled={!selectedOrder}
          sx={{
            py: 1,
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "13px",
            bgcolor: mobileTab === "detail" ? "#1e293b" : "#ffffff",
            color: mobileTab === "detail" ? "#ffffff" : "#475569",
            borderColor: "#cbd5e1",
          }}
        >
          {selectedOrder
            ? `${selectedOrder.tracking_code} & Map`
            : "Details & Map"}
        </Button>
      </Box>

      {/* Main 2-Column Responsive Workspace Grid */}
      <Box className="manager-order-grid">
        {/* LEFT COLUMN: Delivery Queue */}
        <Box
          className={`manager-order-col-list ${mobileTab === "detail" ? "mobile-hidden" : ""}`}
        >
          <Paper
            elevation={0}
            className="manager-order-panel-paper"
            sx={{
              bgcolor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              height: { xs: "auto", md: "calc(100vh - 120px)" },
              minHeight: { md: "620px" },
              overflow: "hidden",
            }}
          >
            {/* Panel Heading */}
            <Box
              sx={{
                px: 2.5,
                py: 2,
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: "#ffffff",
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}
                >
                  Delivery queue
                </Typography>
                <Chip
                  size="small"
                  label={searchedOrders.length}
                  sx={{
                    bgcolor: "#f1f5f9",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "12px",
                    height: 22,
                  }}
                />
              </Stack>
            </Box>

            {/* Material Outlined Search */}
            <Box sx={{ px: 2, pt: 1.5, pb: 1, bgcolor: "#ffffff" }}>
              <OutlinedInput
                fullWidth
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracking ID, customer, address…"
                startAdornment={
                  <InputAdornment position="start">
                    <SearchRounded
                      sx={{ color: "#94a3b8", fontSize: "20px" }}
                    />
                  </InputAdornment>
                }
                endAdornment={
                  searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery("")}
                        edge="end"
                      >
                        <CloseRounded
                          sx={{ fontSize: "16px", color: "#64748b" }}
                        />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                }
                sx={{
                  bgcolor: "#ffffff",
                  borderRadius: "10px",
                  fontSize: "13.5px",
                  "& fieldset": { borderColor: "#e2e8f0" },
                  "&:hover fieldset": { borderColor: "#cbd5e1" },
                  "&.Mui-focused fieldset": {
                    borderColor: "#2563eb",
                    borderWidth: "1.5px",
                  },
                }}
              />
            </Box>

            {/* Material Filter Tabs Chips */}
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                gap: 1,
                overflowX: "auto",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
                bgcolor: "#ffffff",
              }}
            >
              {[
                { id: "all", label: "All", count: orders.length },
                {
                  id: "unassigned",
                  label: "To confirm",
                  count: toConfirmCount,
                },
                { id: "moving", label: "On route", count: movingTabCount },
                { id: "cod", label: "COD due", count: codTabCount },
                {
                  id: "delivered",
                  label: "Delivered",
                  count: deliveredTabCount,
                },
              ].map((tab) => {
                const isActive = filter === tab.id;
                return (
                  <Chip
                    key={tab.id}
                    clickable
                    onClick={() => setFilter(tab.id as FilterTab)}
                    label={`${tab.label} ${tab.count}`}
                    sx={{
                      borderRadius: "999px",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "12.5px",
                      height: 30,
                      px: 0.5,
                      bgcolor: isActive ? "#0f172a" : "#f8fafc",
                      color: isActive ? "#ffffff" : "#475569",
                      border: isActive
                        ? "1px solid #0f172a"
                        : "1px solid #e2e8f0",
                      transition: "all 150ms ease",
                      "&:hover": {
                        bgcolor: isActive ? "#1e293b" : "#f1f5f9",
                      },
                    }}
                  />
                );
              })}
            </Box>

            {/* Scrollable Order Cards List */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                overscrollBehavior: "contain",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                bgcolor: "#fcfdfe",
              }}
            >
              {searchedOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const confirmed = isOrderConfirmed(order);

                return (
                  <Card
                    key={order.id}
                    elevation={0}
                    onClick={() => {
                      setSelectedId(order.id);
                      setMobileTab("detail");
                    }}
                    sx={{
                      p: 2,
                      flexShrink: 0,
                      cursor: "pointer",
                      borderRadius: "12px",
                      border: isSelected
                        ? "2px solid #2563eb"
                        : "1px solid #e2e8f0",
                      bgcolor: isSelected ? "#f8faff" : "#ffffff",
                      boxShadow: isSelected
                        ? "0 4px 12px rgba(37, 99, 235, 0.08)"
                        : "0 1px 2px rgba(0,0,0,0.04)",
                      transition: "all 140ms ease",
                      "&:hover": {
                        borderColor: isSelected ? "#2563eb" : "#cbd5e1",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    {/* Top Row: Tracking & Status */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "14px",
                            color: "#0f172a",
                          }}
                        >
                          {order.tracking_code}
                        </Typography>
                        {isSelected && (
                          <Chip
                            size="small"
                            label="Viewing"
                            sx={{
                              bgcolor: "#dbeafe",
                              color: "#1d4ed8",
                              fontWeight: 700,
                              fontSize: "10px",
                              height: 18,
                            }}
                          />
                        )}
                      </Stack>
                      {renderStatusChip(order.status, order.id)}
                    </Box>

                    {/* Customer Name */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 650,
                        color: "#1e293b",
                        fontSize: "13.5px",
                        mb: 0.75,
                      }}
                    >
                      {order.customer_name}
                      {order.recipient_name &&
                      order.recipient_name !== order.customer_name
                        ? ` → ${order.recipient_name}`
                        : ""}
                    </Typography>

                    {/* Route Flow (Pickup & Delivery) */}
                    <Stack spacing={0.5} sx={{ mb: 1.25 }}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#16a34a",
                            mt: "5px",
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#64748b",
                            fontSize: "12px",
                            lineHeight: 1.3,
                          }}
                          noWrap
                        >
                          From: {order.pickup_address}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "#dc2626",
                            mt: "5px",
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: "#334155",
                            fontSize: "12px",
                            lineHeight: 1.3,
                            fontWeight: 500,
                          }}
                          noWrap
                        >
                          To: {order.delivery_address}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Bottom Metadata Badges */}
                    <Box
                      sx={{
                        pt: 1,
                        borderTop: "1px dashed #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        {order.cod_amount > 0 && (
                          <Chip
                            size="small"
                            icon={
                              <PaymentsOutlined
                                sx={{ fontSize: "13px !important" }}
                              />
                            }
                            label={currency.format(order.cod_amount)}
                            sx={{
                              bgcolor: "#fef3c7",
                              color: "#92400e",
                              fontWeight: 650,
                              fontSize: "11px",
                              height: 20,
                            }}
                          />
                        )}
                        {order.parcel_weight_kg && (
                          <Typography
                            variant="caption"
                            sx={{ color: "#64748b", fontSize: "11px" }}
                          >
                            {order.parcel_weight_kg} kg
                          </Typography>
                        )}
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: "center" }}
                      >
                        <AccessTimeOutlined
                          sx={{ fontSize: "12px", color: "#94a3b8" }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ color: "#64748b", fontSize: "11px" }}
                        >
                          {formatTime(order.estimated_delivery_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Card>
                );
              })}

              {!searchedOrders.length && (
                <Box sx={{ py: 6, px: 3, textAlign: "center" }}>
                  <Inventory2Outlined
                    sx={{ fontSize: 40, color: "#cbd5e1", mb: 1.5 }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: "#475569" }}
                  >
                    No deliveries match this view
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "#94a3b8", display: "block", mt: 0.5 }}
                  >
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : "Try selecting a different filter tab"}
                  </Typography>
                  {searchQuery && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setSearchQuery("")}
                      sx={{
                        mt: 2,
                        textTransform: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      Clear search
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>

        {/* RIGHT COLUMN: Selected Delivery Details & Interactive Map */}
        <Box
          className={`manager-order-col-map ${mobileTab === "list" ? "mobile-hidden" : ""}`}
        >
          {selectedOrder ? (
            <Paper
              elevation={0}
              className="manager-order-map-paper"
              sx={{
                bgcolor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: { md: "sticky" },
                top: { md: "88px" },
                maxHeight: { md: "calc(100vh - 120px)" },
              }}
            >
              {/* Header Bar */}
              <Box
                sx={{
                  px: 2.5,
                  py: 1.75,
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  bgcolor: "#ffffff",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center" }}
                >
                  <Box sx={{ display: { xs: "block", md: "none" } }}>
                    <IconButton
                      size="small"
                      onClick={() => setMobileTab("list")}
                    >
                      <ArrowBack sx={{ fontSize: "18px" }} />
                    </IconButton>
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}
                  >
                    Delivery information & route map
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label={`${movingCount} active in Yangon`}
                  sx={{
                    bgcolor: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                    fontWeight: 650,
                    fontSize: "11px",
                    height: 22,
                  }}
                />
              </Box>

              {/* Scrollable Container with Map and Full Details */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  p: { xs: 2, sm: 2.5 },
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                  bgcolor: "#ffffff",
                  "& > *": { flexShrink: 0 },
                }}
              >
                {/* Notice Alert Banner */}
                {notice && (
                  <Alert
                    severity={notice.tone}
                    onClose={() => setNotice(null)}
                    sx={{
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {notice.text}
                  </Alert>
                )}

                {/* INTERACTIVE DELIVERY MAP */}
                <Box
                  sx={{
                    borderRadius: "14px",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    position: "relative",
                  }}
                >
                  <Box
                    sx={{
                      height: { xs: "280px", sm: "340px" },
                      width: "100%",
                      bgcolor: "#f1f5f9",
                    }}
                  >
                    <LocationMap
                      order={selectedOrder}
                      orders={movingOrders}
                      mode="manager"
                      isDemo={workspace.isDemo}
                      tall
                      roadReports={workspace.data.roadReports}
                    />
                  </Box>
                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 10,
                      left: 12,
                      bgcolor: "rgba(255, 255, 255, 0.95)",
                      backdropFilter: "blur(6px)",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <PlaceRounded sx={{ fontSize: 16, color: "#16a34a" }} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: "#334155" }}
                    >
                      Pickup
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                      →
                    </Typography>
                    <PlaceRounded sx={{ fontSize: 16, color: "#dc2626" }} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, color: "#334155" }}
                    >
                      Drop-off
                    </Typography>
                  </Box>
                </Box>

                {/* HERO HEADER: Tracking Code & Status & Confirm Button */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    bgcolor: "#fafbfc",
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 2,
                  }}
                >
                  <Box>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center", mb: 0.5 }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          fontFamily: "monospace",
                          fontWeight: 800,
                          fontSize: "20px",
                          color: "#0f172a",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {selectedOrder.tracking_code}
                      </Typography>
                      <Tooltip
                        title={copiedId ? "Copied!" : "Copy tracking code"}
                      >
                        <IconButton
                          size="small"
                          onClick={() =>
                            copyTracking(selectedOrder.tracking_code)
                          }
                          sx={{
                            color: copiedId ? "#16a34a" : "#64748b",
                            bgcolor: copiedId ? "#dcfce7" : "#f1f5f9",
                            width: 28,
                            height: 28,
                          }}
                        >
                          {copiedId ? (
                            <CheckCircleOutlined sx={{ fontSize: "15px" }} />
                          ) : (
                            <ContentCopyOutlined sx={{ fontSize: "14px" }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      {renderStatusChip(selectedOrder.status, selectedOrder.id)}
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748b", fontSize: "13px" }}
                    >
                      Estimated arrival:{" "}
                      <strong style={{ color: "#1e293b" }}>
                        {formatTime(selectedOrder.estimated_delivery_at)}
                      </strong>
                    </Typography>
                  </Box>

                  {/* ORDER CONFIRMATION BUTTON - NO LONGER CLICKABLE ONCE CONFIRMED */}
                  <Box sx={{ width: { xs: "100%", sm: "auto" } }}>
                    {isOrderConfirmed(selectedOrder) ? (
                      <Button
                        variant="contained"
                        disabled
                        aria-disabled="true"
                        tabIndex={-1}
                        startIcon={
                          <CheckCircleOutlined
                            sx={{ fontSize: "18px !important" }}
                          />
                        }
                        sx={{
                          width: { xs: "100%", sm: "auto" },
                          bgcolor: "#16a34a !important",
                          color: "#ffffff !important",
                          opacity: "0.95 !important",
                          cursor: "not-allowed !important",
                          pointerEvents: "none !important",
                          fontWeight: 700,
                          fontSize: "14px",
                          textTransform: "none",
                          borderRadius: "10px",
                          py: 1.1,
                          px: 2.75,
                          boxShadow: "none !important",
                        }}
                      >
                        Order Confirmed
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => handleConfirmOrder(selectedOrder)}
                        disabled={savingId === selectedOrder.id}
                        startIcon={<CheckRounded sx={{ fontSize: "18px" }} />}
                        sx={{
                          width: { xs: "100%", sm: "auto" },
                          bgcolor: "#2563eb",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "14px",
                          textTransform: "none",
                          borderRadius: "10px",
                          py: 1.1,
                          px: 2.75,
                          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                          "&:hover": {
                            bgcolor: "#1d4ed8",
                          },
                        }}
                      >
                        {savingId === selectedOrder.id
                          ? "Confirming…"
                          : "Confirm order"}
                      </Button>
                    )}
                  </Box>
                </Paper>

                {/* Confirmation Status Explanatory Card */}
                {isOrderConfirmed(selectedOrder) ? (
                  <Alert
                    severity="success"
                    icon={<CheckCircleOutlined sx={{ color: "#16a34a" }} />}
                    sx={{
                      borderRadius: "12px",
                      bgcolor: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #bbf7d0",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    <strong>Confirmed order.</strong> This delivery is actively
                    queued on the driver job board. Drivers in the cluster can
                    claim and start the delivery. This order is locked and no
                    longer clickable.
                  </Alert>
                ) : (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #fed7aa",
                      bgcolor: "#fffaf5",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, color: "#9a3412", mb: 0.5 }}
                    >
                      Awaiting Manager Confirmation
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#7c2d12",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      Review the pickup address, destination, parcel
                      specifications, and COD payment details. Click{" "}
                      <strong>Confirm order</strong> to immediately cluster and
                      post this job to the driver board.
                    </Typography>
                  </Box>
                )}

                {/* DETAILED DELIVERY SPECIFICATIONS GRID */}
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#334155",
                    mt: 0.5,
                  }}
                >
                  Delivery Information & Addresses
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  {/* Origin: Pickup Information */}
                  <Card
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1.25 }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "8px",
                          bgcolor: "#dcfce7",
                          color: "#15803d",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <StorefrontOutlined sx={{ fontSize: 16 }} />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 750,
                          letterSpacing: "0.06em",
                          color: "#15803d",
                          textTransform: "uppercase",
                        }}
                      >
                        Pickup Location
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 650,
                        color: "#0f172a",
                        fontSize: "14px",
                        mb: 0.5,
                      }}
                    >
                      {selectedOrder.pickup_address}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", display: "block" }}
                    >
                      Sender / Shop:{" "}
                      {selectedOrder.pickup_contact_name ||
                        selectedOrder.customer_name}
                    </Typography>
                    {selectedOrder.pickup_contact_phone && (
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", mt: 1 }}
                      >
                        <PhoneOutlined
                          sx={{ fontSize: 13, color: "#64748b" }}
                        />
                        <Typography
                          component="a"
                          href={`tel:${selectedOrder.pickup_contact_phone}`}
                          variant="caption"
                          sx={{
                            color: "#2563eb",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {selectedOrder.pickup_contact_phone}
                        </Typography>
                      </Stack>
                    )}
                  </Card>

                  {/* Destination: Delivery Address */}
                  <Card
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1.25 }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "8px",
                          bgcolor: "#fee2e2",
                          color: "#b91c1c",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <LocationOnOutlined sx={{ fontSize: 16 }} />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 750,
                          letterSpacing: "0.06em",
                          color: "#b91c1c",
                          textTransform: "uppercase",
                        }}
                      >
                        Drop-off Destination
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 650,
                        color: "#0f172a",
                        fontSize: "14px",
                        mb: 0.5,
                      }}
                    >
                      {selectedOrder.delivery_address}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", display: "block" }}
                    >
                      Recipient:{" "}
                      {selectedOrder.recipient_name ||
                        selectedOrder.customer_name}
                    </Typography>
                    {selectedOrder.recipient_phone && (
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", mt: 1 }}
                      >
                        <PhoneOutlined
                          sx={{ fontSize: 13, color: "#64748b" }}
                        />
                        <Typography
                          component="a"
                          href={`tel:${selectedOrder.recipient_phone}`}
                          variant="caption"
                          sx={{
                            color: "#2563eb",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          {selectedOrder.recipient_phone}
                        </Typography>
                      </Stack>
                    )}
                  </Card>
                </Box>

                {/* PARCEL & PAYMENT & RIDER ASSIGNMENT 3-CARD ROW */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                    gap: 2,
                  }}
                >
                  {/* Parcel Specs */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1 }}
                    >
                      <Inventory2Outlined
                        sx={{ fontSize: 18, color: "#64748b" }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: "#475569" }}
                      >
                        PARCEL GOODS
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 650,
                        color: "#1e293b",
                        fontSize: "13.5px",
                      }}
                    >
                      {selectedOrder.parcel_description || "Standard Box"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", display: "block", mt: 0.5 }}
                    >
                      Weight:{" "}
                      {selectedOrder.parcel_weight_kg
                        ? `${selectedOrder.parcel_weight_kg} kg`
                        : "Standard (< 3kg)"}
                    </Typography>
                  </Paper>

                  {/* Cash on Delivery (COD) */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1 }}
                    >
                      <PaymentsOutlined
                        sx={{ fontSize: 18, color: "#64748b" }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: "#475569" }}
                      >
                        CASH TO COLLECT
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color:
                          selectedOrder.cod_amount > 0 ? "#b45309" : "#166534",
                        fontSize: "15px",
                      }}
                    >
                      {selectedOrder.cod_amount > 0
                        ? currency.format(selectedOrder.cod_amount)
                        : "Prepaid (No COD)"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", display: "block", mt: 0.5 }}
                    >
                      Status: {sentenceCase(selectedOrder.cod_status)}
                    </Typography>
                  </Paper>

                  {/* Driver / Fleet Assignment */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#ffffff",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1 }}
                    >
                      <LocalShippingOutlined
                        sx={{ fontSize: 18, color: "#64748b" }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: "#475569" }}
                      >
                        RIDER DISPATCH
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 650,
                        color: "#1e293b",
                        fontSize: "13.5px",
                      }}
                    >
                      {selectedOrder.driver_name || "Available on Driver Board"}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#64748b", display: "block", mt: 0.5 }}
                    >
                      {selectedOrder.vehicle_label ||
                        (isOrderConfirmed(selectedOrder)
                          ? "Claimable by riders"
                          : "Pending confirmation")}
                    </Typography>
                  </Paper>
                </Box>

                {/* Energy & Traffic Route Assessment (if available) */}
                {assessment && assessment.distanceKm != null && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      bgcolor: "#f8fafc",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", mb: 1.25 }}
                    >
                      <SpeedOutlined sx={{ fontSize: 17, color: "#475569" }} />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: "#475569" }}
                      >
                        ROUTE EFFICIENCY & ENERGY ESTIMATE
                      </Typography>
                    </Stack>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
                      <Chip
                        size="small"
                        icon={
                          <PlaceRounded sx={{ fontSize: "14px !important" }} />
                        }
                        label={`${assessment.distanceKm} km trip`}
                        sx={{
                          bgcolor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          fontWeight: 650,
                          fontSize: "12px",
                        }}
                      />
                      {assessment.fuelLitresEstimated != null && (
                        <Chip
                          size="small"
                          icon={
                            <LocalGasStationOutlined
                              sx={{ fontSize: "14px !important" }}
                            />
                          }
                          label={`${assessment.fuelLitresEstimated} L fuel estimated`}
                          sx={{
                            bgcolor: "#ffffff",
                            border: "1px solid #cbd5e1",
                            fontWeight: 650,
                            fontSize: "12px",
                          }}
                        />
                      )}
                      {assessment.signalsOnRoute != null && (
                        <Chip
                          size="small"
                          icon={
                            <WarningAmber
                              sx={{ fontSize: "14px !important" }}
                            />
                          }
                          label={`${assessment.signalsOnRoute} traffic signals`}
                          sx={{
                            bgcolor: "#ffffff",
                            border: "1px solid #cbd5e1",
                            fontWeight: 650,
                            fontSize: "12px",
                          }}
                        />
                      )}
                    </Box>
                    {assessment.signalBypasses &&
                      assessment.signalBypasses.length > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ color: "#64748b", display: "block", mt: 1.25 }}
                        >
                          Tip: Rotation bypass recommended via{" "}
                          {assessment.signalBypasses[0].recommendedRotation}
                        </Typography>
                      )}
                  </Paper>
                )}
              </Box>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                bgcolor: "#ffffff",
                textAlign: "center",
              }}
            >
              <LocationOnOutlined
                sx={{ fontSize: 48, color: "#cbd5e1", mb: 1.5 }}
              />
              <Typography
                variant="h6"
                sx={{ fontWeight: 650, color: "#475569" }}
              >
                Select a delivery
              </Typography>
              <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5 }}>
                Choose a parcel from the queue to view its route map and confirm
                dispatch.
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}
