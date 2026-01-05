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

          try {
            const slots = await this.client.findAvailableSlots(
              venue.id,
              venue.date,
              partySize
            );

            if (slots.length === 0) {
              console.log(chalk.gray(`  ${venue.name}: No slots available`));
              continue;
            }

            // Filter by preferred times if specified
            const filteredSlots = this.client.filterSlotsByTime(slots, times);

            if (filteredSlots.length === 0) {
              console.log(chalk.gray(`  ${venue.name}: ${slots.length} slots, but none match preferred times`));
              continue;
            }

            const bestSlot = filteredSlots[0];
            console.log(chalk.green(`  ✓ ${venue.name}: Found slot at ${bestSlot.time}!`));

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

export function scheduleAtTime(
  targetTime: Date,
  callback: () => Promise<void>
): cron.ScheduledTask {
  const minute = targetTime.getMinutes();
  const hour = targetTime.getHours();
  const day = targetTime.getDate();
  const month = targetTime.getMonth() + 1;

  const cronExpression = `${minute} ${hour} ${day} ${month} *`;
  
  console.log(chalk.cyan(`⏰ Scheduled to run at ${targetTime.toLocaleString()}`));
  
  return cron.schedule(cronExpression, async () => {
    console.log(chalk.green('⏰ Scheduled time reached! Starting...'));
    await callback();
  });
}

