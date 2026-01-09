// Configuration types
export interface ResyConfig {
  email: string;
  password: string;
  apiKey: string;
  venues: VenueConfig[];
  defaultPartySize: number;
  preferredTimes?: string[]; // e.g., ["19:00", "19:30", "20:00"]
  preferredTableTypes?: string[]; // e.g., ["Table", "Bar Seats", "Patio"]
  scheduledStartTime?: string; // e.g., "2026-01-15 18:00" or "18:00"
}

export interface VenueConfig {
  id: number;
  name: string;
  date: string; // YYYY-MM-DD format
  partySize?: number; // Override default party size
  preferredTimes?: string[]; // Override default preferred times
  preferredTableTypes?: string[]; // e.g., ["Table", "Bar Seats", "Patio"]
}

// Resy API response types
export interface AuthResponse {
  id: number;
  token: string;
  first_name: string;
  last_name: string;
  em_address: string;
  payment_method_id: number;
}

export interface FindResponse {
  query: {
    day: string;
    party_size: number;
    time_filter: string | null;
  };
  bookmark: string | null;
  results: {
    venues: VenueResult[];
    meta: {
      offset: number;
      limit: number | null;
    };
  };
  platinum_night: unknown | null;
}

export interface VenueResult {
  venue: VenueInfo;
  templates: Record<string, Template>;
  slots: Slot[];
  gating_errors: Record<string, unknown>;
  notifies: unknown[];
  pickups: {
    slots: unknown[];
    service_types: Record<string, unknown>;
  };
}

export interface VenueInfo {
  id: {
    resy: number;
  };
  venue_group: {
    id: number;
    name: string;
    venues: number[];
  };
  name: string;
  type: string;
  url_slug: string;
  price_range: number;
  average_bill_size: number;
  currency_symbol: string;
  hospitality_included: number;
  resy_select: number;
  is_gdc: number;
  is_global_dining_access: boolean;
  is_global_dining_access_only: boolean;
  requires_reservation_transfers: number;
  is_gns: number;
  transaction_processor: string;
  hide_allergy_question: boolean;
  hide_occasion_question: boolean;
  hide_special_request_question: boolean;
  gda_concierge_booking: boolean;
  tax_included: boolean;
  feature_recaptcha: boolean;
  rating: number;
  total_ratings: number;
  inventory: {
    type: {
      id: number;
    };
  };
  reopen: {
    date: string;
  };
  location: {
    time_zone: string;
    neighborhood: string;
    geo: {
      lat: number;
      lon: number;
    };
    code: string;
    name: string;
    url_slug: string;
  };
  travel_time: {
    distance: number;
  };
  source: {
    name: string | null;
    logo: string | null;
    terms_of_service: string | null;
    privacy_policy: string | null;
  };
  service_types: Record<string, unknown>;
  top: boolean;
  ticket: {
    average: number;
    average_str: string;
  };
  currency: {
    symbol: string;
    code: string;
  };
  is_rga: boolean;
  is_rga_only: boolean;
  default_template: string;
  responsive_images: {
    originals: Record<string, { url: string }>;
    urls: Record<string, Record<string, Record<string, string>>>;
    urls_by_resolution: Record<string, Record<string, Record<string, string>>>;
    file_names: string[];
    aspect_ratios: Record<string, Record<string, string>>;
  };
  notify_options: NotifyOption[];
  favorite: boolean;
  waitlist: {
    available: number;
    label: string;
    current: unknown | null;
  };
  supports_pickups: number;
  collections: Collection[];
  content: VenueContent[];
  allow_bypass_payment_method: number;
  events: unknown[];
}

export interface NotifyOption {
  service_type_id: number;
  min_request_datetime: string;
  max_request_datetime: string;
  step_minutes: number;
}

export interface Collection {
  id: number;
  type_id: number;
  file_name: string;
  image: string;
  name: string;
  short_name: string;
  description: string;
  collection_slug: string;
}

export interface VenueContent {
  attribution: string | null;
  body: string;
  display: {
    type: string;
  };
  icon: {
    url: string;
  };
  locale: {
    language: string;
  };
  name: string;
  title: string | null;
}

export interface Template {
  is_paid: boolean;
  venue_share: number | null;
  restriction_id: number | null;
  payment_structure: number | null;
  cancellation_fee: number | null;
  secs_cancel_cut_off: number | null;
  time_cancel_cut_off: string | null;
  secs_change_cut_off: number | null;
  time_change_cut_off: string | null;
  large_party_size_cancel: number | null;
  large_party_cancellation_fee: number | null;
  large_party_secs_cancel_cut_off: number | null;
  large_party_time_cancel_cut_off: string | null;
  large_party_secs_change_cut_off: number | null;
  large_party_time_change_cut_off: string | null;
  deposit_fee: number | null;
  service_charge: string | null;
  service_charge_options: unknown[];
  images: string[] | null;
  raw_image_names: string[] | null;
  image_dimensions: number[][] | null;
  is_default: number;
  is_event: number;
  is_pickup: number;
  pickup_highlight: number;
  venue_id: number;
  reservation_config: {
    badge: string | null;
    type: string;
    secs_off_market: number | null;
    time_off_market: string | null;
  };
  turn_times: TurnTime[];
  display_config: {
    color: {
      background: string | null;
      font: string | null;
    };
  };
  content: Record<string, TemplateContent>;
  id: number;
  menu: Record<string, unknown[]>;
  name: string;
  item_ids: number[];
  menu_ids: number[];
}

export interface TurnTime {
  secs_amount: number;
  size: {
    max: number | null;
    min: number;
  };
}

export interface TemplateContent {
  about: {
    attribution: string | null;
    body: string;
    enhanced_body: string | null;
    title: string | null;
  };
  need_to_know: {
    attribution: string | null;
    body: string;
    enhanced_body: string | null;
    title: string | null;
  };
  why_we_like_it: {
    attribution: string | null;
    body: string;
    enhanced_body: string | null;
    title: string | null;
  };
}

export interface Slot {
  availability: {
    id: number;
  };
  config: {
    id: number;
    custom_config_name: string | null;
    token: string;
    type: string;
    is_visible: boolean;
  };
  custom_config: {
    object_id: number | null;
    name: string | null;
  };
  date: {
    end: string;
    start: string;
  };
  exclusive: {
    id: number;
    is_eligible: boolean;
  };
  is_global_dining_access: boolean;
  floorplan: {
    id: number;
  };
  id: number | null;
  market: {
    date: {
      off: number;
      on: number;
    };
  };
  meta: {
    size: {
      assumed: number;
    };
    type: {
      id: number;
    };
  };
  lock: unknown | null;
  pacing: {
    beyond: boolean;
  };
  score: {
    total: number;
  };
  shift: {
    id: number;
    service: {
      type: {
        id: number;
      };
    };
    day: string;
  };
  size: {
    max: number;
    min: number;
  };
  status: {
    id: number;
  };
  table: {
    id: number[];
  };
  template: {
    id: number;
  };
  time: {
    turn: {
      actual: number;
      estimated: number;
    };
  };
  quantity: number;
  display_config: {
    color: {
      background: string;
      font: string;
    };
  };
  reservation_config: {
    badge: string | null;
  };
  gdc_perk: unknown | null;
  has_add_ons: boolean;
  payment: SlotPayment;
}

export interface SlotPayment {
  is_paid: boolean;
  cancellation_fee: number | null;
  deposit_fee: number | null;
  service_charge: string;
  venue_share: number;
  payment_structure: number;
  secs_cancel_cut_off: number;
  time_cancel_cut_off: string | null;
  secs_change_cut_off: number;
  time_change_cut_off: string | null;
  service_charge_options: unknown[];
}

export interface DetailsResponse {
  book_token: {
    value: string;
    date_expires: string;
  };
  cancellation: {
    credit: {
      date_cut_off: string | null;
    };
    display: {
      policy: string[];
    };
    fee: number | null;
    refund: {
      date_cut_off: string;
    };
  };
  change: {
    date_cut_off: string;
  };
  config: {
    add_ons: unknown | null;
    double_confirmation: string[];
    features: unknown | null;
    menu_items: unknown[];
    service_charge_options: unknown | null;
  };
  locale: {
    currency: string;
  };
  payment: {
    amounts: {
      items: unknown[];
      reservation_charge: number;
      subtotal: number;
      add_ons: number;
      quantity: number;
      resy_fee: number;
      service_fee: number;
      service_charge: {
        amount: number;
        value: string;
      };
      tax: number;
      total: number;
      surcharge: number;
      price_per_unit: number;
    };
    comp: boolean;
    config: {
      type: string;
    };
    display: {
      balance: {
        value: string;
        modifier: string;
      };
      buy: {
        action: string;
        after_modifier: string;
        before_modifier: string;
        init: string;
        value: string;
      };
      description: string[];
    };
    options: PaymentOption[];
  };
  user: {
    payment_methods: PaymentMethod[];
  };
  venue: {
    config: {
      allow_bypass_payment_method: number;
      allow_multiple_resys: number;
      enable_invite: number;
      enable_resypay: number;
      hospitality_included: number;
    };
    content: VenueContent[];
    location: {
      address_1: string;
      address_2: string | null;
      code: string;
      country: string;
      cross_street_1: string;
      cross_street_2: string;
      id: number;
      latitude: number;
      locality: string;
      longitude: number;
      neighborhood: string;
      postal_code: string;
      region: string;
    };
    contact: {
      phone_number: string;
    };
    rater: VenueRater[];
    source: {
      name: string | null;
      logo: string | null;
      terms_of_service: string | null;
      privacy_policy: string | null;
    };
  };
  viewers: {
    total: number;
  };
}

export interface PaymentOption {
  amounts: {
    price_per_unit: number;
    resy_fee: number;
    service_fee: number;
    service_charge: {
      amount: number;
      value: string;
    };
    tax: number;
    total: number;
  };
}

export interface PaymentMethod {
  id: number;
  is_default: boolean;
  provider_id: number;
  provider_name: string;
  display: string;
  type: string;
  exp_year: number;
  exp_month: number;
  issuing_bank: string | null;
}

export interface VenueRater {
  name: string;
  scale: number;
  score: number;
  total: number;
}

export interface BookingResponse {
  resy_token: string;
  reservation_id: number;
  venue_opt_in: boolean;
}

// CLI types
export type CommandAction = 'check' | 'book' | 'snipe';

export interface CliOptions {
  config?: string;
  venue?: number;
  date?: string;
  partySize?: number;
  time?: string;
  interval?: number; // For snipe mode, in seconds
  dryRun?: boolean;
  startAt?: string; // Scheduled start time e.g., "2026-01-15 18:00" or "18:00"
}

// Internal types
export interface AvailableSlot {
  venueId: number;
  venueName: string;
  date: string;
  time: string;
  configId: number;
  token: string;
  partySize: number;
  type: string;
  deposit?: number;
  tableType?: string; // e.g., "Table", "Patio"
  quantity: number; // Number of tables available at this time
}

export interface BookingResult {
  success: boolean;
  reservationId?: number;
  venueName?: string;
  date?: string;
  time?: string;
  partySize?: number;
  error?: string;
}
