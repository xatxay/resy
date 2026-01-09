import * as cron from 'node-cron';
import { ResyClient } from './resy-client';
import { VenueConfig, AvailableSlot, BookingResult } from './types';
import chalk from 'chalk';

export interface SnipeOptions {
  intervalSeconds: number;
  maxAttempts?: number;
  dryRun?: boolean;
  onSlotFound?: (slot: AvailableSlot) => void;
  onBookingComplete?: (result: BookingResult) => void;
}

export class ResyScheduler {
  private client: ResyClient;
  private isRunning: boolean = false;
  private attemptCount: number = 0;
  private scheduledTask: cron.ScheduledTask | null = null;

  constructor(client: ResyClient) {
    this.client = client;
  }

  async snipe(
    venues: VenueConfig[],
    defaultPartySize: number,
    preferredTimes: string[] | undefined,
    preferredTableTypes: string[] | undefined,
    options: SnipeOptions
  ): Promise<BookingResult | null> {
    this.isRunning = true;
    this.attemptCount = 0;

    console.log(chalk.cyan('\n🎯 Starting reservation sniper...'));
    console.log(chalk.gray(`Checking every ${options.intervalSeconds} seconds`));
    if (options.maxAttempts) {
      console.log(chalk.gray(`Max attempts: ${options.maxAttempts}`));
    }
    if (options.dryRun) {
      console.log(chalk.yellow('⚠ DRY RUN MODE - Will not actually book'));
    }
    console.log('');

    return new Promise((resolve) => {
      const checkAndBook = async () => {
        if (!this.isRunning) {
          resolve(null);
          return;
        }

        this.attemptCount++;
        const timestamp = new Date().toLocaleTimeString();
        console.log(chalk.gray(`[${timestamp}] Attempt #${this.attemptCount}`));

        for (const venue of venues) {
          const partySize = venue.partySize || defaultPartySize;
          const times = venue.preferredTimes || preferredTimes;
          const tableTypes = venue.preferredTableTypes || preferredTableTypes;

          try {
            let slots = await this.client.findAvailableSlots(
              venue.id,
              venue.date,
              partySize
            );

            if (slots.length === 0) {
              console.log(chalk.gray(`  ${venue.name}: No slots available`));
              continue;
            }

            // Filter by table type if specified
            slots = this.client.filterSlotsByTableType(slots, tableTypes);

            if (slots.length === 0) {
              console.log(chalk.gray(`  ${venue.name}: No slots matching preferred table types`));
              continue;
            }

            // Filter by preferred times if specified
            const filteredSlots = this.client.filterSlotsByTime(slots, times);

            if (filteredSlots.length === 0) {
              console.log(chalk.gray(`  ${venue.name}: ${slots.length} slots, but none match preferred times`));
              continue;
            }

            const bestSlot = filteredSlots[0];
            console.log(chalk.green(`  ✓ ${venue.name}: Found slot at ${bestSlot.time} (${bestSlot.type})!`));

            if (options.onSlotFound) {
              options.onSlotFound(bestSlot);
            }

            if (options.dryRun) {
              console.log(chalk.yellow('  ⚠ Skipping booking (dry run mode)'));
              continue;
            }

            // Attempt to book
            console.log(chalk.cyan(`  📞 Attempting to book...`));
            const result = await this.client.bookReservation(bestSlot);

            if (result.success) {
              console.log(chalk.green.bold(`\n🎉 SUCCESS! Reservation booked!`));
              console.log(chalk.green(`   ${result.venueName}`));
              console.log(chalk.green(`   ${result.date} at ${result.time}`));
              console.log(chalk.green(`   Party of ${result.partySize}`));
              console.log(chalk.green(`   Confirmation: ${result.reservationId}`));

              if (options.onBookingComplete) {
                options.onBookingComplete(result);
              }

              this.stop();
              resolve(result);
              return;
            } else {
              console.log(chalk.red(`  ✗ Booking failed: ${result.error}`));
            }
          } catch (error: any) {
            console.log(chalk.red(`  ✗ Error checking ${venue.name}: ${error.message}`));
          }
        }

        // Check max attempts
        if (options.maxAttempts && this.attemptCount >= options.maxAttempts) {
          console.log(chalk.yellow(`\n⚠ Max attempts (${options.maxAttempts}) reached. Stopping.`));
          this.stop();
          resolve(null);
          return;
        }
      };

      // Run immediately first
      checkAndBook();

      // Then schedule periodic checks
      const cronExpression = `*/${Math.max(1, Math.floor(options.intervalSeconds / 60)) || 1} * * * *`;
      
      // For intervals less than 60 seconds, use setInterval instead
      if (options.intervalSeconds < 60) {
        const intervalId = setInterval(async () => {
          if (!this.isRunning) {
            clearInterval(intervalId);
            return;
          }
          await checkAndBook();
        }, options.intervalSeconds * 1000);
      } else {
        this.scheduledTask = cron.schedule(cronExpression, checkAndBook);
      }
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }
    console.log(chalk.gray('\nSniper stopped.'));
  }

  getAttemptCount(): number {
    return this.attemptCount;
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Parse a scheduled time string into a Date object
 * Supports formats:
 * - "2026-01-15 18:00" or "2026-01-15 18:00:00" (full date and time)
 * - "18:00" or "18:00:00" (time only, defaults to today if not passed, otherwise tomorrow)
 * - "2026-01-15T18:00:00" (ISO 8601 format)
 */
export function parseScheduledTime(timeString: string): Date {
  const now = new Date();
  
  // Try parsing as ISO 8601 first
  if (timeString.includes('T')) {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Check if it's a full date-time format (YYYY-MM-DD HH:MM or YYYY-MM-DD HH:MM:SS)
  const fullDateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const fullMatch = timeString.match(fullDateTimeRegex);
  
  if (fullMatch) {
    const [, year, month, day, hour, minute, second] = fullMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      second ? parseInt(second) : 0
    );
  }
  
  // Check if it's time only format (HH:MM or HH:MM:SS)
  const timeOnlyRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const timeMatch = timeString.match(timeOnlyRegex);
  
  if (timeMatch) {
    const [, hour, minute, second] = timeMatch;
    const targetDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      parseInt(hour),
      parseInt(minute),
      second ? parseInt(second) : 0
    );
    
    // If the time has already passed today, schedule for tomorrow
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    return targetDate;
  }
  
  throw new Error(
    `Invalid time format: "${timeString}". ` +
    `Supported formats: "YYYY-MM-DD HH:MM", "HH:MM", or "YYYY-MM-DDTHH:MM:SS"`
  );
}

export function scheduleAtTime(
  targetTime: Date,
  callback: () => Promise<void>
): void {
  const now = new Date();
  
  // Calculate milliseconds until execution
  const msUntilExecution = targetTime.getTime() - now.getTime();
  
  // Validate that the target time is in the future (at least 1 second)
  if (msUntilExecution < 1000) {
    throw new Error(
      `Scheduled time must be at least 1 second in the future. ` +
      `Target: ${targetTime.toLocaleString()}, Current: ${now.toLocaleString()}`
    );
  }
  
  console.log(chalk.cyan(`⏰ Scheduled to run at ${targetTime.toLocaleString()}`));
  
  // Calculate and display time until execution
  const secondsUntil = Math.floor(msUntilExecution / 1000);
  const minutesUntil = Math.floor(secondsUntil / 60);
  const hoursUntil = Math.floor(minutesUntil / 60);
  
  if (hoursUntil > 0) {
    console.log(chalk.gray(`   (in ${hoursUntil} hour(s) and ${minutesUntil % 60} minute(s))`));
  } else if (minutesUntil > 0) {
    console.log(chalk.gray(`   (in ${minutesUntil} minute(s) and ${secondsUntil % 60} second(s))`));
  } else {
    console.log(chalk.gray(`   (in ${secondsUntil} second(s))`));
  }
  console.log(chalk.gray('   Waiting...\n'));
  
  // Use setTimeout for one-time scheduled execution
  setTimeout(async () => {
    console.log(chalk.green('⏰ Scheduled time reached! Starting...\n'));
    await callback();
  }, msUntilExecution);
}

