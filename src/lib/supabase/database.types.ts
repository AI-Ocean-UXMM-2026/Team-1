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
          customer_id: string | null;
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
          notes: string | null;
          priority: string;
          reproduce_count: number;
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
          customer_id?: string | null;
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
          notes?: string | null;
          priority?: string;
          reproduce_count?: number;
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
          customer_id?: string | null;
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
          notes?: string | null;
          priority?: string;
          reproduce_count?: number;
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
      delivery_order_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          order_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          order_id: string;
          quantity?: number;
          unit_price?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          order_id?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
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
          next_action: string;
          outcome: string;
          parcel_verified: boolean;
          recipient_name: string | null;
          reported_at: string;
          request_id: string | null;
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
          next_action?: string;
          outcome: string;
          parcel_verified?: boolean;
          recipient_name?: string | null;
          reported_at?: string;
          request_id?: string | null;
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
          next_action?: string;
          outcome?: string;
          parcel_verified?: boolean;
          recipient_name?: string | null;
          reported_at?: string;
          request_id?: string | null;
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
      job_batches: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          job_count: number;
          order_count: number;
          trigger: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          job_count?: number;
          order_count?: number;
          trigger: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          job_count?: number;
          order_count?: number;
          trigger?: string;
        };
        Relationships: [];
      };
      delivery_jobs: {
        Row: {
          area_label: string | null;
          batch_id: string;
          center_latitude: number | null;
          center_longitude: number | null;
          claimed_at: string | null;
          claimed_by: string | null;
          cod_total: number;
          completed_at: string | null;
          created_at: string;
          id: string;
          label: string;
          order_count: number;
          route_id: string | null;
          started_at: string | null;
          status: string;
          total_weight_kg: number;
          vehicle_id: string | null;
          reproduce_count: number;
          priority: string;
          reproduced_from_job_id: string | null;
          metadata: Json;
        };
        Insert: {
          area_label?: string | null;
          batch_id: string;
          center_latitude?: number | null;
          center_longitude?: number | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          cod_total?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          label: string;
          order_count: number;
          route_id?: string | null;
          started_at?: string | null;
          status?: string;
          total_weight_kg?: number;
          vehicle_id?: string | null;
          reproduce_count?: number;
          priority?: string;
          reproduced_from_job_id?: string | null;
          metadata?: Json;
        };
        Update: {
          area_label?: string | null;
          batch_id?: string;
          center_latitude?: number | null;
          center_longitude?: number | null;
          claimed_at?: string | null;
          claimed_by?: string | null;
          cod_total?: number;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          label?: string;
          order_count?: number;
          route_id?: string | null;
          started_at?: string | null;
          status?: string;
          total_weight_kg?: number;
          vehicle_id?: string | null;
          reproduce_count?: number;
          priority?: string;
          reproduced_from_job_id?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      delivery_queue: {
        Row: {
          job_id: string | null;
          order_id: string;
          queued_at: string;
          queued_by: string;
          auto_accepted: boolean;
          reproduce_count: number;
          last_calculated_at: string | null;
        };
        Insert: {
          job_id?: string | null;
          order_id: string;
          queued_at?: string;
          queued_by: string;
          auto_accepted?: boolean;
          reproduce_count?: number;
          last_calculated_at?: string | null;
        };
        Update: {
          job_id?: string | null;
          order_id?: string;
          queued_at?: string;
          queued_by?: string;
          auto_accepted?: boolean;
          reproduce_count?: number;
          last_calculated_at?: string | null;
        };
        Relationships: [];
      };
      driver_route_sessions: {
        Row: {
          closed_at: string | null;
          cod_declared: number | null;
          driver_id: string;
          id: string;
          pause_reason: string | null;
          paused_at: string | null;
          route_date: string;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          closed_at?: string | null;
          cod_declared?: number | null;
          driver_id: string;
          id?: string;
          pause_reason?: string | null;
          paused_at?: string | null;
          route_date?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          cod_declared?: number | null;
          driver_id?: string;
          id?: string;
          pause_reason?: string | null;
          paused_at?: string | null;
          route_date?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_routes: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          depot_id: string | null;
          dispatch_run_id: string | null;
          dispatch_run_route_id: string | null;
          driver_id: string;
          id: string;
          planned_at: string;
          planned_depart_at: string | null;
          planned_return_at: string | null;
          service_date: string | null;
          started_at: string | null;
          status: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          depot_id?: string | null;
          dispatch_run_id?: string | null;
          dispatch_run_route_id?: string | null;
          driver_id: string;
          id?: string;
          planned_at?: string;
          planned_depart_at?: string | null;
          planned_return_at?: string | null;
          service_date?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          depot_id?: string | null;
          dispatch_run_id?: string | null;
          dispatch_run_route_id?: string | null;
          driver_id?: string;
          id?: string;
          planned_at?: string;
          planned_depart_at?: string | null;
          planned_return_at?: string | null;
          service_date?: string | null;
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
            foreignKeyName: "delivery_routes_depot_id_fkey";
            columns: ["depot_id"];
            isOneToOne: false;
            referencedRelation: "depots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_routes_dispatch_run_id_fkey";
            columns: ["dispatch_run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_routes_dispatch_run_route_id_fkey";
            columns: ["dispatch_run_route_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_run_routes";
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
      rider_assistance_requests: {
        Row: {
          acknowledged_at: string | null;
          category: string;
          created_at: string;
          driver_id: string;
          energy_level_percent: number | null;
          handled_by: string | null;
          id: string;
          kind: string;
          latitude: number | null;
          longitude: number | null;
          note: string | null;
          order_id: string | null;
          resolved_at: string | null;
          status: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          category: string;
          created_at?: string;
          driver_id: string;
          energy_level_percent?: number | null;
          handled_by?: string | null;
          id?: string;
          kind: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          order_id?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          category?: string;
          created_at?: string;
          driver_id?: string;
          energy_level_percent?: number | null;
          handled_by?: string | null;
          id?: string;
          kind?: string;
          latitude?: number | null;
          longitude?: number | null;
          note?: string | null;
          order_id?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rider_assistance_requests_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "rider_assistance_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_assistance_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_assistance_requests_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
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
          arrived_at: string | null;
          completed_at: string | null;
          created_at: string;
          dispatch_run_stop_id: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          order_id: string;
          planned_arrival_at: string | null;
          planned_departure_at: string | null;
          route_id: string;
          sequence_number: number;
          status: string;
          stop_type: string;
          window_end_at: string | null;
          window_start_at: string | null;
        };
        Insert: {
          address: string;
          arrived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispatch_run_stop_id?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id: string;
          planned_arrival_at?: string | null;
          planned_departure_at?: string | null;
          route_id: string;
          sequence_number: number;
          status?: string;
          stop_type: string;
          window_end_at?: string | null;
          window_start_at?: string | null;
        };
        Update: {
          address?: string;
          arrived_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispatch_run_stop_id?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          order_id?: string;
          planned_arrival_at?: string | null;
          planned_departure_at?: string | null;
          route_id?: string;
          sequence_number?: number;
          status?: string;
          stop_type?: string;
          window_end_at?: string | null;
          window_start_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "route_stops_dispatch_run_stop_id_fkey";
            columns: ["dispatch_run_stop_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_run_stops";
            referencedColumns: ["id"];
          },
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
      delivery_order_logistics: {
        Row: {
          backfill_source: string | null;
          backfilled_at: string | null;
          created_at: string;
          deadline_hard: boolean;
          deadline_source: string | null;
          delivery_deadline_at: string | null;
          delivery_township_pcode: string | null;
          depot_id: string | null;
          fragile: boolean;
          order_id: string;
          origin_kind: string;
          parcel_size: string | null;
          pickup_township_pcode: string | null;
          pickup_window_end: string | null;
          pickup_window_start: string | null;
          price_basis: Json | null;
          price_is_estimate: boolean | null;
          quoted_at: string | null;
          quoted_price_mmk: number | null;
          size_source: string | null;
          township_source: string | null;
          updated_at: string;
          volume_m3: number | null;
          volume_source: string | null;
          weight_kg: number | null;
          weight_source: string | null;
          window_label: string | null;
          window_source: string | null;
        };
        Insert: {
          backfill_source?: string | null;
          backfilled_at?: string | null;
          created_at?: string;
          deadline_hard?: boolean;
          deadline_source?: string | null;
          delivery_deadline_at?: string | null;
          delivery_township_pcode?: string | null;
          depot_id?: string | null;
          fragile?: boolean;
          order_id: string;
          origin_kind?: string;
          parcel_size?: string | null;
          pickup_township_pcode?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          price_basis?: Json | null;
          price_is_estimate?: boolean | null;
          quoted_at?: string | null;
          quoted_price_mmk?: number | null;
          size_source?: string | null;
          township_source?: string | null;
          updated_at?: string;
          volume_m3?: number | null;
          volume_source?: string | null;
          weight_kg?: number | null;
          weight_source?: string | null;
          window_label?: string | null;
          window_source?: string | null;
        };
        Update: {
          backfill_source?: string | null;
          backfilled_at?: string | null;
          created_at?: string;
          deadline_hard?: boolean;
          deadline_source?: string | null;
          delivery_deadline_at?: string | null;
          delivery_township_pcode?: string | null;
          depot_id?: string | null;
          fragile?: boolean;
          order_id?: string;
          origin_kind?: string;
          parcel_size?: string | null;
          pickup_township_pcode?: string | null;
          pickup_window_end?: string | null;
          pickup_window_start?: string | null;
          price_basis?: Json | null;
          price_is_estimate?: boolean | null;
          quoted_at?: string | null;
          quoted_price_mmk?: number | null;
          size_source?: string | null;
          township_source?: string | null;
          updated_at?: string;
          volume_m3?: number | null;
          volume_source?: string | null;
          weight_kg?: number | null;
          weight_source?: string | null;
          window_label?: string | null;
          window_source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_order_logistics_delivery_township_pcode_fkey";
            columns: ["delivery_township_pcode"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["pcode"];
          },
          {
            foreignKeyName: "delivery_order_logistics_depot_id_fkey";
            columns: ["depot_id"];
            isOneToOne: false;
            referencedRelation: "depots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_order_logistics_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_order_logistics_pickup_township_pcode_fkey";
            columns: ["pickup_township_pcode"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["pcode"];
          },
        ];
      };
      depots: {
        Row: {
          address: string | null;
          closes_at: string;
          code: string;
          coordinate_source: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          location_status: string;
          longitude: number | null;
          name: string;
          opens_at: string;
          timezone: string;
          township_pcode: string | null;
          updated_at: string;
          verification_note: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          address?: string | null;
          closes_at?: string;
          code: string;
          coordinate_source?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          location_status?: string;
          longitude?: number | null;
          name: string;
          opens_at?: string;
          timezone?: string;
          township_pcode?: string | null;
          updated_at?: string;
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          address?: string | null;
          closes_at?: string;
          code?: string;
          coordinate_source?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number | null;
          location_status?: string;
          longitude?: number | null;
          name?: string;
          opens_at?: string;
          timezone?: string;
          township_pcode?: string | null;
          updated_at?: string;
          verification_note?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "depots_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_run_edits: {
        Row: {
          actor_id: string;
          created_at: string;
          edit_type: string;
          id: number;
          next: Json | null;
          order_id: string | null;
          previous: Json | null;
          reason: string;
          revision_after: number | null;
          revision_before: number | null;
          run_id: string;
          run_route_id: string | null;
          violations: Json;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          edit_type: string;
          id?: never;
          next?: Json | null;
          order_id?: string | null;
          previous?: Json | null;
          reason: string;
          revision_after?: number | null;
          revision_before?: number | null;
          run_id: string;
          run_route_id?: string | null;
          violations?: Json;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          edit_type?: string;
          id?: never;
          next?: Json | null;
          order_id?: string | null;
          previous?: Json | null;
          reason?: string;
          revision_after?: number | null;
          revision_before?: number | null;
          run_id?: string;
          run_route_id?: string | null;
          violations?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_run_edits_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_edits_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_edits_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_edits_run_route_id_fkey";
            columns: ["run_route_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_run_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_run_matrices: {
        Row: {
          created_at: string;
          distance_m: number[];
          duration_s: number[];
          elements_billed: number;
          nodes: Json;
          profile: string;
          provider: string;
          run_id: string;
          source_mask: number[] | null;
        };
        Insert: {
          created_at?: string;
          distance_m: number[];
          duration_s: number[];
          elements_billed?: number;
          nodes: Json;
          profile: string;
          provider: string;
          run_id: string;
          source_mask?: number[] | null;
        };
        Update: {
          created_at?: string;
          distance_m?: number[];
          duration_s?: number[];
          elements_billed?: number;
          nodes?: Json;
          profile?: string;
          provider?: string;
          run_id?: string;
          source_mask?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_run_matrices_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: true;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_run_orders: {
        Row: {
          deadline_at: string | null;
          deadline_hard: boolean;
          delivery_township_pcode: string | null;
          disposition: string;
          logistics_updated_at: string | null;
          manual_override: boolean;
          order_id: string;
          order_updated_at: string;
          origin_kind: string;
          pickup_township_pcode: string | null;
          run_id: string;
          run_route_id: string | null;
          unassigned_detail: Json;
          unassigned_reason: string | null;
          volume_m3: number | null;
          volume_source: string | null;
          weight_kg: number | null;
          weight_source: string | null;
          window_end_at: string | null;
          window_source: string | null;
          window_start_at: string | null;
        };
        Insert: {
          deadline_at?: string | null;
          deadline_hard?: boolean;
          delivery_township_pcode?: string | null;
          disposition: string;
          logistics_updated_at?: string | null;
          manual_override?: boolean;
          order_id: string;
          order_updated_at: string;
          origin_kind: string;
          pickup_township_pcode?: string | null;
          run_id: string;
          run_route_id?: string | null;
          unassigned_detail?: Json;
          unassigned_reason?: string | null;
          volume_m3?: number | null;
          volume_source?: string | null;
          weight_kg?: number | null;
          weight_source?: string | null;
          window_end_at?: string | null;
          window_source?: string | null;
          window_start_at?: string | null;
        };
        Update: {
          deadline_at?: string | null;
          deadline_hard?: boolean;
          delivery_township_pcode?: string | null;
          disposition?: string;
          logistics_updated_at?: string | null;
          manual_override?: boolean;
          order_id?: string;
          order_updated_at?: string;
          origin_kind?: string;
          pickup_township_pcode?: string | null;
          run_id?: string;
          run_route_id?: string | null;
          unassigned_detail?: Json;
          unassigned_reason?: string | null;
          volume_m3?: number | null;
          volume_source?: string | null;
          weight_kg?: number | null;
          weight_source?: string | null;
          window_end_at?: string | null;
          window_source?: string | null;
          window_start_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_run_orders_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_orders_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_orders_run_route_id_fkey";
            columns: ["run_route_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_run_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_run_routes: {
        Row: {
          cap_kg_used: number | null;
          cap_m3_used: number | null;
          committed_route_id: string | null;
          display_order: number;
          distance_km: number;
          driver_id: string | null;
          energy_status: string | null;
          explanation: Json;
          flags: string[];
          id: string;
          locked: boolean;
          p90_return_at: string | null;
          peak_kg: number;
          peak_m3: number;
          planned_depart_at: string;
          planned_return_at: string;
          run_id: string;
          score_cohesion: number;
          score_cost: number;
          score_flood: number;
          score_late: number;
          score_time: number;
          score_total: number;
          score_uncertainty: number;
          service_min: number;
          travel_min: number;
          usable_range_km: number | null;
          vehicle_id: string;
          wait_min: number;
        };
        Insert: {
          cap_kg_used?: number | null;
          cap_m3_used?: number | null;
          committed_route_id?: string | null;
          display_order?: number;
          distance_km?: number;
          driver_id?: string | null;
          energy_status?: string | null;
          explanation?: Json;
          flags?: string[];
          id?: string;
          locked?: boolean;
          p90_return_at?: string | null;
          peak_kg?: number;
          peak_m3?: number;
          planned_depart_at: string;
          planned_return_at: string;
          run_id: string;
          score_cohesion?: number;
          score_cost?: number;
          score_flood?: number;
          score_late?: number;
          score_time?: number;
          score_total?: number;
          score_uncertainty?: number;
          service_min?: number;
          travel_min?: number;
          usable_range_km?: number | null;
          vehicle_id: string;
          wait_min?: number;
        };
        Update: {
          cap_kg_used?: number | null;
          cap_m3_used?: number | null;
          committed_route_id?: string | null;
          display_order?: number;
          distance_km?: number;
          driver_id?: string | null;
          energy_status?: string | null;
          explanation?: Json;
          flags?: string[];
          id?: string;
          locked?: boolean;
          p90_return_at?: string | null;
          peak_kg?: number;
          peak_m3?: number;
          planned_depart_at?: string;
          planned_return_at?: string;
          run_id?: string;
          score_cohesion?: number;
          score_cost?: number;
          score_flood?: number;
          score_late?: number;
          score_time?: number;
          score_total?: number;
          score_uncertainty?: number;
          service_min?: number;
          travel_min?: number;
          usable_range_km?: number | null;
          vehicle_id?: string;
          wait_min?: number;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_run_routes_committed_route_id_fkey";
            columns: ["committed_route_id"];
            isOneToOne: false;
            referencedRelation: "delivery_routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_routes_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "dispatch_run_routes_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_routes_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_run_stops: {
        Row: {
          address: string;
          alternatives: Json;
          committed_stop_id: string | null;
          id: string;
          latitude: number;
          leg_flood_km: number | null;
          leg_km: number | null;
          leg_min: number | null;
          load_after_kg: number | null;
          load_after_m3: number | null;
          locked: boolean;
          longitude: number;
          manual: boolean;
          order_id: string;
          p90_arrival_at: string | null;
          planned_arrival_at: string;
          planned_departure_at: string | null;
          reasons: Json;
          run_id: string;
          run_route_id: string;
          seq: number;
          slack_min: number | null;
          stop_type: string;
          township_pcode: string | null;
          window_end_at: string | null;
          window_start_at: string | null;
        };
        Insert: {
          address: string;
          alternatives?: Json;
          committed_stop_id?: string | null;
          id?: string;
          latitude: number;
          leg_flood_km?: number | null;
          leg_km?: number | null;
          leg_min?: number | null;
          load_after_kg?: number | null;
          load_after_m3?: number | null;
          locked?: boolean;
          longitude: number;
          manual?: boolean;
          order_id: string;
          p90_arrival_at?: string | null;
          planned_arrival_at: string;
          planned_departure_at?: string | null;
          reasons?: Json;
          run_id: string;
          run_route_id: string;
          seq: number;
          slack_min?: number | null;
          stop_type: string;
          township_pcode?: string | null;
          window_end_at?: string | null;
          window_start_at?: string | null;
        };
        Update: {
          address?: string;
          alternatives?: Json;
          committed_stop_id?: string | null;
          id?: string;
          latitude?: number;
          leg_flood_km?: number | null;
          leg_km?: number | null;
          leg_min?: number | null;
          load_after_kg?: number | null;
          load_after_m3?: number | null;
          locked?: boolean;
          longitude?: number;
          manual?: boolean;
          order_id?: string;
          p90_arrival_at?: string | null;
          planned_arrival_at?: string;
          planned_departure_at?: string | null;
          reasons?: Json;
          run_id?: string;
          run_route_id?: string;
          seq?: number;
          slack_min?: number | null;
          stop_type?: string;
          township_pcode?: string | null;
          window_end_at?: string | null;
          window_start_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_run_stops_committed_stop_id_fkey";
            columns: ["committed_stop_id"];
            isOneToOne: false;
            referencedRelation: "route_stops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_stops_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "delivery_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_stops_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_run_stops_run_route_id_fkey";
            columns: ["run_route_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_run_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      dispatch_runs: {
        Row: {
          client_key: string;
          commit_key: string | null;
          committed_at: string | null;
          committed_by: string | null;
          created_at: string;
          created_by: string;
          data_quality: string;
          data_quality_detail: Json;
          depot_id: string;
          discard_reason: string | null;
          discarded_at: string | null;
          discarded_by: string | null;
          engine_version: string;
          id: string;
          iterations: number | null;
          params: Json;
          parent_run_id: string | null;
          revision: number;
          runtime_ms: number | null;
          score_breakdown: Json;
          score_total: number | null;
          seed: number | null;
          service_date: string;
          status: string;
          stop_reason: string | null;
          synthetic: boolean;
        };
        Insert: {
          client_key: string;
          commit_key?: string | null;
          committed_at?: string | null;
          committed_by?: string | null;
          created_at?: string;
          created_by: string;
          data_quality: string;
          data_quality_detail?: Json;
          depot_id: string;
          discard_reason?: string | null;
          discarded_at?: string | null;
          discarded_by?: string | null;
          engine_version: string;
          id?: string;
          iterations?: number | null;
          params?: Json;
          parent_run_id?: string | null;
          revision?: number;
          runtime_ms?: number | null;
          score_breakdown?: Json;
          score_total?: number | null;
          seed?: number | null;
          service_date: string;
          status?: string;
          stop_reason?: string | null;
          synthetic?: boolean;
        };
        Update: {
          client_key?: string;
          commit_key?: string | null;
          committed_at?: string | null;
          committed_by?: string | null;
          created_at?: string;
          created_by?: string;
          data_quality?: string;
          data_quality_detail?: Json;
          depot_id?: string;
          discard_reason?: string | null;
          discarded_at?: string | null;
          discarded_by?: string | null;
          engine_version?: string;
          id?: string;
          iterations?: number | null;
          params?: Json;
          parent_run_id?: string | null;
          revision?: number;
          runtime_ms?: number | null;
          score_breakdown?: Json;
          score_total?: number | null;
          seed?: number | null;
          service_date?: string;
          status?: string;
          stop_reason?: string | null;
          synthetic?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_runs_committed_by_fkey";
            columns: ["committed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_runs_depot_id_fkey";
            columns: ["depot_id"];
            isOneToOne: false;
            referencedRelation: "depots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_runs_discarded_by_fkey";
            columns: ["discarded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispatch_runs_parent_run_id_fkey";
            columns: ["parent_run_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      geo_hazard_layers: {
        Row: {
          assumptions: Json;
          bbox: number[] | null;
          captured_on: string | null;
          crs: string;
          feature_count: number | null;
          geojson: Json;
          hazard_classes: Json;
          id: string;
          kind: string;
          license: string | null;
          loaded_at: string;
          name: string;
          simplify_tol_deg: number | null;
          source_name: string;
          source_url: string | null;
          status: string;
        };
        Insert: {
          assumptions?: Json;
          bbox?: number[] | null;
          captured_on?: string | null;
          crs?: string;
          feature_count?: number | null;
          geojson: Json;
          hazard_classes?: Json;
          id?: string;
          kind: string;
          license?: string | null;
          loaded_at?: string;
          name: string;
          simplify_tol_deg?: number | null;
          source_name: string;
          source_url?: string | null;
          status?: string;
        };
        Update: {
          assumptions?: Json;
          bbox?: number[] | null;
          captured_on?: string | null;
          crs?: string;
          feature_count?: number | null;
          geojson?: Json;
          hazard_classes?: Json;
          id?: string;
          kind?: string;
          license?: string | null;
          loaded_at?: string;
          name?: string;
          simplify_tol_deg?: number | null;
          source_name?: string;
          source_url?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      service_areas: {
        Row: {
          boundary: Json | null;
          centroid_lat: number | null;
          centroid_lng: number | null;
          created_at: string;
          district: string | null;
          name_en: string;
          name_my: string | null;
          pcode: string;
          source: string;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          boundary?: Json | null;
          centroid_lat?: number | null;
          centroid_lng?: number | null;
          created_at?: string;
          district?: string | null;
          name_en: string;
          name_my?: string | null;
          pcode: string;
          source: string;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          boundary?: Json | null;
          centroid_lat?: number | null;
          centroid_lng?: number | null;
          created_at?: string;
          district?: string | null;
          name_en?: string;
          name_my?: string | null;
          pcode?: string;
          source?: string;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehicle_dispatch_profiles: {
        Row: {
          capacity_m3: number | null;
          cost_per_km_mmk: number | null;
          cost_source: string;
          created_at: string;
          default_driver_id: string | null;
          depot_id: string | null;
          fixed_cost_mmk: number | null;
          shift_end: string | null;
          shift_start: string | null;
          speed_factor: number;
          updated_at: string;
          updated_by: string | null;
          vehicle_id: string;
        };
        Insert: {
          capacity_m3?: number | null;
          cost_per_km_mmk?: number | null;
          cost_source?: string;
          created_at?: string;
          default_driver_id?: string | null;
          depot_id?: string | null;
          fixed_cost_mmk?: number | null;
          shift_end?: string | null;
          shift_start?: string | null;
          speed_factor?: number;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id: string;
        };
        Update: {
          capacity_m3?: number | null;
          cost_per_km_mmk?: number | null;
          cost_source?: string;
          created_at?: string;
          default_driver_id?: string | null;
          depot_id?: string | null;
          fixed_cost_mmk?: number | null;
          shift_end?: string | null;
          shift_start?: string | null;
          speed_factor?: number;
          updated_at?: string;
          updated_by?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_dispatch_profiles_default_driver_id_fkey";
            columns: ["default_driver_id"];
            isOneToOne: false;
            referencedRelation: "driver_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "vehicle_dispatch_profiles_depot_id_fkey";
            columns: ["depot_id"];
            isOneToOne: false;
            referencedRelation: "depots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_dispatch_profiles_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_dispatch_profiles_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
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
      queue_orders: {
        Args: { p_order_ids: string[] };
        Returns: number;
      };
      unqueue_orders: {
        Args: { p_order_ids: string[] };
        Returns: number;
      };
      create_job_batch: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      auto_accept_orders: {
        Args: { p_order_ids?: string[] | null };
        Returns: number;
      };
      reproduce_unclaimed_tasks: {
        Args: {
          p_max_age_interval?: string | null;
          p_max_orders?: number;
          p_max_kg?: number;
        };
        Returns: Json;
      };
      run_auto_accept_and_reproduce_workflow: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      claim_delivery_job: {
        Args: { p_job_id: string; p_vehicle_id?: string | null };
        Returns: string;
      };
      release_delivery_job: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      complete_delivery: {
        Args: {
          target_order_id: string;
          client_request_id: string;
          delivery_outcome: string;
          parcel_checked?: boolean;
          received_by?: string | null;
          reason?: string | null;
          follow_up?: string;
          delivery_note?: string | null;
          cod_received?: number | null;
          cod_reason?: string | null;
        };
        Returns: Json;
      };
      create_customer_pickup_order: {
        Args: {
          p_cod_amount: number;
          p_delivery_address: string;
          p_delivery_latitude?: number | null;
          p_delivery_longitude?: number | null;
          p_parcel_description: string;
          p_pickup_address: string;
          p_pickup_contact_phone?: string | null;
          p_pickup_latitude?: number | null;
          p_pickup_longitude?: number | null;
          p_recipient_name: string;
          p_recipient_phone: string;
        };
        Returns: {
          id: string;
          tracking_code: string;
          created_at: string;
        }[];
      };
      create_manual_delivery_order: {
        Args: {
          p_cod_amount?: number;
          p_delivery_address: string;
          p_items: Json;
          p_notes?: string | null;
          p_pickup_address: string;
          p_receiver_name: string;
          p_receiver_phone: string;
          p_sender_name: string;
          p_sender_phone: string;
        };
        Returns: {
          id: string;
          tracking_code: string;
          status: string;
          assigned_driver_id: string | null;
          assigned_vehicle_id: string | null;
        }[];
      };
      set_driver_route_state: {
        Args: {
          next_state: string;
          reason?: string | null;
          declared_cod?: number | null;
        };
        Returns: Database["public"]["Tables"]["driver_route_sessions"]["Row"];
      };
      track_delivery: {
        Args: { code: string };
        Returns: Json;
      };
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
      commit_dispatch_run: {
        Args: {
          p_commit_key: string;
          p_expected_revision: number;
          p_on_stale?: string;
          p_run_id: string;
        };
        Returns: Json;
      };
      discard_dispatch_run: {
        Args: { p_reason: string; p_run_id: string };
        Returns: Json;
      };
      save_dispatch_run: {
        Args: {
          p_client_key: string;
          p_payload: Json;
          p_replace_draft?: boolean;
        };
        Returns: Json;
      };
      set_depot_location: {
        Args: {
          p_depot_id: string;
          p_latitude: number;
          p_longitude: number;
          p_note?: string;
          p_source: string;
        };
        Returns: {
          address: string | null;
          closes_at: string;
          code: string;
          coordinate_source: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number | null;
          location_status: string;
          longitude: number | null;
          name: string;
          opens_at: string;
          timezone: string;
          township_pcode: string | null;
          updated_at: string;
          verification_note: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "depots";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_order_logistics: {
        Args: { p_order_id: string; p_patch: Json; p_reason: string };
        Returns: {
          backfill_source: string | null;
          backfilled_at: string | null;
          created_at: string;
          deadline_hard: boolean;
          deadline_source: string | null;
          delivery_deadline_at: string | null;
          delivery_township_pcode: string | null;
          depot_id: string | null;
          fragile: boolean;
          order_id: string;
          origin_kind: string;
          parcel_size: string | null;
          pickup_township_pcode: string | null;
          pickup_window_end: string | null;
          pickup_window_start: string | null;
          price_basis: Json | null;
          price_is_estimate: boolean | null;
          quoted_at: string | null;
          quoted_price_mmk: number | null;
          size_source: string | null;
          township_source: string | null;
          updated_at: string;
          volume_m3: number | null;
          volume_source: string | null;
          weight_kg: number | null;
          weight_source: string | null;
          window_label: string | null;
          window_source: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "delivery_order_logistics";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
