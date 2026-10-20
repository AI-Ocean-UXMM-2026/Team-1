export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      cod_payments: {
        Row: {
          amount: number;
          collected_at: string;
          collected_by: string;
          created_at: string;
          id: string;
          order_id: string;
          payment_method: string;
          settled_at: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          collected_at?: string;
          collected_by: string;
          created_at?: string;
          id?: string;
          order_id: string;
          payment_method: string;
          settled_at?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          collected_at?: string;
          collected_by?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          payment_method?: string;
          settled_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cod_payments_collected_by_fkey";
            columns: ["collected_by"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "cod_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string;
          created_at: string;
          driver_id: string;
          ended_at: string | null;
          id: string;
          order_id: string;
          route_id: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          assigned_at?: string;
          assigned_by: string;
          created_at?: string;
          driver_id: string;
          ended_at?: string | null;
          id?: string;
          order_id: string;
          route_id?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string;
          created_at?: string;
          driver_id?: string;
          ended_at?: string | null;
          id?: string;
          order_id?: string;
          route_id?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_assignments_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_assignments_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "delivery_routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_assignments_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_locations: {
        Row: {
          accuracy_meters: number | null;
          driver_id: string;
          id: number;
          latitude: number;
          longitude: number;
          order_id: string;
          recorded_at: string;
        };
        Insert: {
          accuracy_meters?: number | null;
          driver_id: string;
          id?: never;
          latitude: number;
          longitude: number;
          order_id: string;
          recorded_at?: string;
        };
        Update: {
          accuracy_meters?: number | null;
          driver_id?: string;
          id?: never;
          latitude?: number;
          longitude?: number;
          order_id?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_locations_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "delivery_locations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_notifications: {
        Row: {
          channel: string;
          created_at: string;
          id: string;
          message: string;
          notification_type: string;
          order_id: string;
          recipient_id: string;
          scheduled_at: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          id?: string;
          message: string;
          notification_type: string;
          order_id: string;
          recipient_id: string;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          id?: string;
          message?: string;
          notification_type?: string;
          order_id?: string;
          recipient_id?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_orders: {
        Row: {
          cod_amount: number;
          cod_status: string;
          created_at: string;
          created_by: string;
          customer_id: string;
          delivered_at: string | null;
          delivery_address: string;
          delivery_latitude: number | null;
          delivery_longitude: number | null;
          estimated_delivery_at: string | null;
          eta_confidence: string | null;
          eta_updated_at: string | null;
          id: string;
          parcel_description: string | null;
          parcel_weight_kg: number | null;
          pickup_address: string;
          pickup_contact_name: string | null;
          pickup_contact_phone: string | null;
          pickup_latitude: number | null;
          pickup_longitude: number | null;
          recipient_name: string | null;
          recipient_phone: string | null;
          route_progress_percent: number | null;
          status: string;
          traffic_delay_minutes: number;
          tracking_code: string;
          updated_at: string;
        };
        Insert: {
          cod_amount?: number;
          cod_status?: string;
          created_at?: string;
          created_by: string;
          customer_id: string;
          delivered_at?: string | null;
          delivery_address: string;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          estimated_delivery_at?: string | null;
          eta_confidence?: string | null;
          eta_updated_at?: string | null;
          id?: string;
          parcel_description?: string | null;
          parcel_weight_kg?: number | null;
          pickup_address: string;
          pickup_contact_name?: string | null;
          pickup_contact_phone?: string | null;
          pickup_latitude?: number | null;
          pickup_longitude?: number | null;
          recipient_name?: string | null;
          recipient_phone?: string | null;
          route_progress_percent?: number | null;
          status?: string;
          traffic_delay_minutes?: number;
          tracking_code?: string;
          updated_at?: string;
        };
        Update: {
          cod_amount?: number;
          cod_status?: string;
          created_at?: string;
          created_by?: string;
          customer_id?: string;
          delivered_at?: string | null;
          delivery_address?: string;
          delivery_latitude?: number | null;
          delivery_longitude?: number | null;
          estimated_delivery_at?: string | null;
          eta_confidence?: string | null;
          eta_updated_at?: string | null;
          id?: string;
          parcel_description?: string | null;
          parcel_weight_kg?: number | null;
          pickup_address?: string;
          pickup_contact_name?: string | null;
          pickup_contact_phone?: string | null;
          pickup_latitude?: number | null;
          pickup_longitude?: number | null;
          recipient_name?: string | null;
          recipient_phone?: string | null;
          route_progress_percent?: number | null;
          status?: string;
          traffic_delay_minutes?: number;
          tracking_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_outcome_reports: {
        Row: {
          cod_collected: number | null;
          cod_discrepancy_reason: string | null;
          cod_expected: number;
          driver_id: string;
          failure_reason: string | null;
          id: string;
          note: string | null;
          order_id: string;
          outcome: string;
          recipient_name: string | null;
          reported_at: string;
        };
        Insert: {
          cod_collected?: number | null;
          cod_discrepancy_reason?: string | null;
          cod_expected?: number;
          driver_id: string;
          failure_reason?: string | null;
          id?: string;
          note?: string | null;
          order_id: string;
          outcome: string;
          recipient_name?: string | null;
          reported_at?: string;
        };
        Update: {
          cod_collected?: number | null;
          cod_discrepancy_reason?: string | null;
          cod_expected?: number;
          driver_id?: string;
          failure_reason?: string | null;
          id?: string;
          note?: string | null;
          order_id?: string;
          outcome?: string;
          recipient_name?: string | null;
          reported_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_outcome_reports_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "delivery_outcome_reports_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_routes: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          driver_id: string;
          id: string;
          planned_at: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          driver_id: string;
          id?: string;
          planned_at?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          driver_id?: string;
          id?: string;
          planned_at?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_routes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_routes_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "delivery_routes_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_status_events: {
        Row: {
          changed_by: string | null;
          created_at: string;
          id: number;
          note: string | null;
          order_id: string;
          status: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          order_id: string;
          status: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          id?: never;
          note?: string | null;
          order_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_status_events_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_status_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      driver_profiles: {
        Row: {
          availability: string;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          availability?: string;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          availability?: string;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "driver_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      road_reports: {
        Row: {
          category: string;
          description: string;
          driver_id: string;
          expires_at: string;
          id: string;
          latitude: number;
          longitude: number;
          order_id: string | null;
          reported_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          description: string;
          driver_id: string;
          expires_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          order_id?: string | null;
          reported_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          description?: string;
          driver_id?: string;
          expires_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          order_id?: string | null;
          reported_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "road_reports_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "road_reports_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "road_reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      route_stops: {
        Row: {
          address: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          order_id: string;
          route_id: string;
          sequence_number: number;
          status: string;
          stop_type: string;
        };
        Insert: {
          address: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id: string;
          route_id: string;
          sequence_number: number;
          status?: string;
          stop_type: string;
        };
        Update: {
          address?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id?: string;
          route_id?: string;
          sequence_number?: number;
          status?: string;
          stop_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "route_stops_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_stops_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "delivery_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      commerce_integrations: {
        Row: {
          created_at: string;
          external_account_id: string | null;
          id: string;
          last_synced_at: string | null;
          provider_name: string;
          provider_type: string;
          seller_id: string;
          status: string;
          store_name: string;
          sync_mode: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          provider_name: string;
          provider_type?: string;
          seller_id: string;
          status?: string;
          store_name: string;
          sync_mode?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          last_synced_at?: string | null;
          provider_name?: string;
          provider_type?: string;
          seller_id?: string;
          status?: string;
          store_name?: string;
          sync_mode?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_cost_entries: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          created_by: string;
          id: string;
          incurred_at: string;
          notes: string | null;
          order_id: string | null;
          vehicle_id: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          created_by: string;
          id?: string;
          incurred_at?: string;
          notes?: string | null;
          order_id?: string | null;
          vehicle_id?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          incurred_at?: string;
          notes?: string | null;
          order_id?: string | null;
          vehicle_id?: string | null;
        };
        Relationships: [];
      };
      external_shipments: {
        Row: {
          created_at: string;
          customer_id: string | null;
          destination_label: string | null;
          estimated_delivery_at: string | null;
          external_order_reference: string | null;
          id: string;
          integration_id: string | null;
          latest_event_at: string | null;
          local_order_id: string | null;
          metadata: Json;
          origin_label: string | null;
          provider_name: string;
          seller_id: string | null;
          status: string;
          tracking_code: string;
          tracking_url: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          destination_label?: string | null;
          estimated_delivery_at?: string | null;
          external_order_reference?: string | null;
          id?: string;
          integration_id?: string | null;
          latest_event_at?: string | null;
          local_order_id?: string | null;
          metadata?: Json;
          origin_label?: string | null;
          provider_name: string;
          seller_id?: string | null;
          status?: string;
          tracking_code: string;
          tracking_url?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          destination_label?: string | null;
          estimated_delivery_at?: string | null;
          external_order_reference?: string | null;
          id?: string;
          integration_id?: string | null;
          latest_event_at?: string | null;
          local_order_id?: string | null;
          metadata?: Json;
          origin_label?: string | null;
          provider_name?: string;
          seller_id?: string | null;
          status?: string;
          tracking_code?: string;
          tracking_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_cases: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          description: string;
          id: string;
          order_id: string | null;
          priority: string;
          requester_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          order_id?: string | null;
          priority?: string;
          requester_id: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          order_id?: string | null;
          priority?: string;
          requester_id?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_maintenance_records: {
        Row: {
          completed_at: string | null;
          cost_amount: number;
          created_at: string;
          created_by: string;
          id: string;
          maintenance_type: string;
          notes: string | null;
          odometer_km: number | null;
          scheduled_for: string | null;
          status: string;
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          completed_at?: string | null;
          cost_amount?: number;
          created_at?: string;
          created_by: string;
          id?: string;
          maintenance_type: string;
          notes?: string | null;
          odometer_km?: number | null;
          scheduled_for?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          completed_at?: string | null;
          cost_amount?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          maintenance_type?: string;
          notes?: string | null;
          odometer_km?: number | null;
          scheduled_for?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          battery_level_percent: number | null;
          capacity_kg: number | null;
          created_at: string;
          energy_source: string;
          fuel_level_percent: number | null;
          id: string;
          make: string | null;
          model: string | null;
          odometer_km: number;
          range_km_at_full: number | null;
          registration_number: string;
          reserve_percent: number;
          service_due_at_km: number | null;
          status: string;
          updated_at: string;
          vehicle_type: string;
        };
        Insert: {
          battery_level_percent?: number | null;
          capacity_kg?: number | null;
          created_at?: string;
          energy_source?: string;
          fuel_level_percent?: number | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          odometer_km?: number;
          range_km_at_full?: number | null;
          registration_number: string;
          reserve_percent?: number;
          service_due_at_km?: number | null;
          status?: string;
          updated_at?: string;
          vehicle_type: string;
        };
        Update: {
          battery_level_percent?: number | null;
          capacity_kg?: number | null;
          created_at?: string;
          energy_source?: string;
          fuel_level_percent?: number | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          odometer_km?: number;
          range_km_at_full?: number | null;
          registration_number?: string;
          reserve_percent?: number;
          service_due_at_km?: number | null;
          status?: string;
          updated_at?: string;
          vehicle_type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      latest_delivery_locations: {
        Row: {
          id: number | null;
          order_id: string | null;
          driver_id: string | null;
          latitude: number | null;
          longitude: number | null;
          accuracy_meters: number | null;
          recorded_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ensure_delivery_route: {
        Args: { target_order_id: string };
        Returns: string;
      };
      assign_delivery: {
        Args: {
          target_order_id: string;
          target_driver_id: string;
          target_vehicle_id?: string | null;
        };
        Returns: string;
      };
      review_road_report: {
        Args: { decision: string; target_report_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
