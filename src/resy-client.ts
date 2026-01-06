import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {
  AuthResponse,
  FindResponse,
  DetailsResponse,
  BookingResponse,
  AvailableSlot,
  BookingResult,
  Slot,
} from './types';

const RESY_API_URL = 'https://api.resy.com';
const TOKEN_CACHE_FILE = '.resy-token';

export class ResyClient {
  private apiKey: string;
  private email: string;
  private password: string;
  private authToken: string | null = null;
  private paymentMethodId: number | null = null;
  private client: AxiosInstance;

  constructor(apiKey: string, email: string, password: string) {
    this.apiKey = apiKey;
    this.email = email;
    this.password = password;
    this.client = axios.create({
      baseURL: RESY_API_URL,
      headers: {
        'Authorization': `ResyAPI api_key="${apiKey}"`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://resy.com',
        'Referer': 'https://resy.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    this.loadCachedToken();
  }

  private loadCachedToken(): void {
    const tokenPath = path.join(process.cwd(), TOKEN_CACHE_FILE);
    try {
      if (fs.existsSync(tokenPath)) {
        const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        if (data.token && data.expiry && new Date(data.expiry) > new Date()) {
          this.authToken = data.token;
          this.paymentMethodId = data.paymentMethodId;
        }
      }
    } catch {
      // Token cache doesn't exist or is invalid
    }
  }

  private saveCachedToken(): void {
    const tokenPath = path.join(process.cwd(), TOKEN_CACHE_FILE);
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24); // Token valid for 24 hours
    fs.writeFileSync(
      tokenPath,
      JSON.stringify({
        token: this.authToken,
        paymentMethodId: this.paymentMethodId,
        expiry: expiry.toISOString(),
      })
    );
  }

  async authenticate(): Promise<boolean> {
    if (this.authToken) {
      return true;
    }

    try {
      const params = new URLSearchParams();
      params.append('email', this.email);
      params.append('password', this.password);

      const response = await this.client.post<AuthResponse>(
        '/3/auth/password',
        params.toString()
      );

      this.authToken = response.data.token;
      this.paymentMethodId = response.data.payment_method_id;
      this.saveCachedToken();

      console.log(`✓ Authenticated as ${response.data.first_name} ${response.data.last_name}`);
      return true;
    } catch (error: any) {
      console.error('✗ Authentication failed:', error.response?.data?.message || error.message);
      return false;
    }
  }

  async findAvailableSlots(
    venueId: number,
    date: string,
    partySize: number
  ): Promise<AvailableSlot[]> {
    if (!this.authToken) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate');
      }
    }

    try {
      // /4/find uses POST with JSON body
      const response = await this.client.post<FindResponse>(
        '/4/find',
        {
          lat: 0,
          long: 0,
          day: date,
          party_size: partySize,
          venue_id: venueId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Resy-Auth-Token': this.authToken,
            'X-Resy-Universal-Auth': this.authToken,
            'X-Origin': 'https://resy.com',
          },
        }
      );

      const slots: AvailableSlot[] = [];
      
      for (const venue of response.data.results?.venues || []) {
        for (const slot of venue.slots || []) {
          slots.push(this.parseSlot(slot, venue.venue.id.resy, venue.venue.name, date, partySize));
        }
      }

      return slots;
    } catch (error: any) {
      console.error('✗ Failed to find slots:', error.response?.data?.message || error.message);
      return [];
    }
  }

  private parseSlot(
    slot: Slot,
    venueId: number,
    venueName: string,
    date: string,
    partySize: number
  ): AvailableSlot {
    // Parse the time from the date string (format: "2026-01-25 10:00:00")
    const startDateTime = slot.date.start;
    const timePart = startDateTime.split(' ')[1]; // "10:00:00"
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

    return {
      venueId,
      venueName,
      date,
      time: timeStr,
      configId: slot.config.id,
      token: slot.config.token,
      partySize,
      type: slot.config.type,
      tableType: slot.config.type, // e.g., "Table", "Patio"
      deposit: slot.payment?.deposit_fee ?? undefined,
      quantity: slot.quantity,
    };
  }

  async getBookingDetails(configToken: string, date: string, partySize: number): Promise<DetailsResponse | null> {
    if (!this.authToken) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error('Failed to authenticate');
      }
    }

    try {
      // /3/details uses POST with JSON body
      const response = await this.client.post<DetailsResponse>(
        '/3/details',
        {
          commit: 1,
          config_id: configToken, // This is the token like "rgs://resy/54602/..."
          day: date,
          party_size: partySize.toString(), // API expects string
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Resy-Auth-Token': this.authToken,
            'X-Resy-Universal-Auth': this.authToken,
            'X-Origin': 'https://resy.com',
          },
        }
      );

      // Update payment method ID from response if available
      if (response.data.user?.payment_methods?.length > 0) {
        const defaultMethod = response.data.user.payment_methods.find(m => m.is_default) 
          || response.data.user.payment_methods[0];
        this.paymentMethodId = defaultMethod.id;
      }

      return response.data;
    } catch (error: any) {
      console.error('✗ Failed to get booking details:', error.response?.data?.message || error.message);
      return null;
    }
  }

  async bookReservation(slot: AvailableSlot): Promise<BookingResult> {
    if (!this.authToken) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        return { success: false, error: 'Failed to authenticate' };
      }
    }

    try {
      // First, get the book token using the slot's config token
      const details = await this.getBookingDetails(slot.token, slot.date, slot.partySize);
      if (!details) {
        return { success: false, error: 'Failed to get booking details' };
      }

      const bookToken = details.book_token.value;

      // Then, make the booking
      const params = new URLSearchParams();
      params.append('book_token', bookToken);
      params.append('struct_payment_method', JSON.stringify({
        id: this.paymentMethodId,
      }));
      params.append('source_id', 'resy.com-venue-details');
      params.append('venue_marketing_opt_in', '0');

      const response = await this.client.post<BookingResponse>(
        '/3/book',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Resy-Auth-Token': this.authToken,
            'X-Resy-Universal-Auth': this.authToken,
            'X-Origin': 'https://resy.com',
          },
        }
      );

      return {
        success: true,
        reservationId: response.data.reservation_id,
        venueName: slot.venueName,
        date: slot.date,
        time: slot.time,
        partySize: slot.partySize,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  filterSlotsByTime(slots: AvailableSlot[], preferredTimes?: string[]): AvailableSlot[] {
    if (!preferredTimes || preferredTimes.length === 0) {
      return slots;
    }

    // Convert preferred times to comparable format
    const normalizedPreferred = preferredTimes.map((t) => this.normalizeTime(t));

    // 30 minute tolerance
    // return slots.filter((slot) => {
    //   const slotTime = this.normalizeTime(slot.time);
    //   return normalizedPreferred.some((preferred) => 
    //     this.isTimeWithinRange(slotTime, preferred, 30) // 30 minute tolerance
    //   );
    // });
    // Filter slots within tolerance and calculate distance to nearest preferred time
    const slotsWithDistance = slots
      .map((slot) => {
        const slotTime = this.normalizeTime(slot.time);
        const minDistance = Math.min(
          ...normalizedPreferred.map((preferred) => Math.abs(slotTime - preferred))
        );
        return { slot, distance: minDistance };
      })
      .filter(({ distance }) => distance <= 15); // 15 minute tolerance (stricter)

    // Sort by distance to preferred time (closest first)
    slotsWithDistance.sort((a, b) => a.distance - b.distance);

    return slotsWithDistance.map(({ slot }) => slot);
  }

  private normalizeTime(time: string): number {
    // Convert time string to minutes since midnight
    const cleaned = time.toLowerCase().replace(/\s/g, '');
    let hours: number;
    let minutes: number;

    if (cleaned.includes('am') || cleaned.includes('pm')) {
      const match = cleaned.match(/(\d{1,2}):?(\d{2})?(am|pm)/);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2] || '0', 10);
        if (match[3] === 'pm' && hours !== 12) hours += 12;
        if (match[3] === 'am' && hours === 12) hours = 0;
      } else {
        return 0;
      }
    } else {
      const parts = time.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1] || '0', 10);
    }

    return hours * 60 + minutes;
  }

  private isTimeWithinRange(time: number, target: number, toleranceMinutes: number): boolean {
    return Math.abs(time - target) <= toleranceMinutes;
  }
}

