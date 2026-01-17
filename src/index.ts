#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ResyClient } from './resy-client';
import { ResyScheduler, parseScheduledTime, scheduleAtTime } from './scheduler';
import { ResyConfig, AvailableSlot } from './types';

const program = new Command();

function loadConfig(configPath?: string): ResyConfig {
  const defaultPath = path.join(process.cwd(), 'config.json');
  const filePath = configPath || defaultPath;

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`✗ Config file not found: ${filePath}`));
    console.error(chalk.gray('  Create a config.json file based on config.example.json'));
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    console.error(chalk.red(`✗ Failed to parse config file: ${error.message}`));
    process.exit(1);
  }
}

function displaySlots(slots: AvailableSlot[]): void {
  if (slots.length === 0) {
    console.log(chalk.yellow('  No available slots found.'));
    return;
  }

  console.log(chalk.green(`  Found ${slots.length} available slot(s):\n`));
  
  slots.forEach((slot, index) => {
    const depositInfo = slot.deposit ? chalk.gray(` ($${slot.deposit} deposit)`) : '';
    console.log(
      chalk.white(`  ${index + 1}. `) +
      chalk.cyan(slot.time) +
      chalk.gray(` - ${slot.type}`) +
      depositInfo
    );
  });
}

function printBanner(): void {
  console.log(chalk.cyan(`
╔═══════════════════════════════════════╗
║         🍽️  Resy Reservation          ║
║            Booking Tool               ║
╚═══════════════════════════════════════╝
`));
}

async function executeWithSchedule(
  cliStartAt: string | undefined,
  config: ResyConfig,
  callback: () => Promise<void>
): Promise<void> {
  // CLI option takes precedence over config file
  const scheduledTimeString = cliStartAt || config.scheduledStartTime;
  
  if (!scheduledTimeString) {
    // No scheduling, execute immediately
    await callback();
    return;
  }
  
  try {
    const targetTime = parseScheduledTime(scheduledTimeString);
    
    // Schedule the execution
    scheduleAtTime(targetTime, callback);
    
    // Keep the process alive
    // The setTimeout in scheduleAtTime will execute the callback at the scheduled time
    await new Promise(() => {}); // Wait indefinitely
  } catch (error: any) {
    console.error(chalk.red(`✗ Error parsing scheduled time: ${error.message}`));
    process.exit(1);
  }
}

program
  .name('resy')
  .description('CLI tool to check and book Resy reservations')
  .version('1.0.0');

// Check command - display available slots
program
  .command('check')
  .description('Check available reservation slots')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --venue <id>', 'Venue ID to check', parseInt)
  .option('-d, --date <date>', 'Date to check (YYYY-MM-DD)')
  .option('-p, --party-size <size>', 'Party size', parseInt)
  .option('-T, --table-type <type>', 'Preferred table type (e.g., "Table", "Bar Seats")')
  .option('-s, --start-at <datetime>', 'Schedule start time (e.g., "18:00" or "2026-01-15 18:00")')
  .action(async (options) => {
    printBanner();
    const config = loadConfig(options.config);
    
    await executeWithSchedule(options.startAt, config, async () => {
      const client = new ResyClient(config.apiKey, config.email, config.password);

      console.log(chalk.cyan('🔍 Checking availability...\n'));

      // Authenticate first
      const authenticated = await client.authenticate();
      if (!authenticated) {
        process.exit(1);
      }

      console.log('');

      // If specific venue/date provided via CLI, use those
      if (options.venue && options.date) {
        const partySize = options.partySize || config.defaultPartySize;
        const tableTypes = options.tableType ? [options.tableType] : config.preferredTableTypes;
        console.log(chalk.white(`Venue ID: ${options.venue}`));
        console.log(chalk.white(`Date: ${options.date}`));
        console.log(chalk.white(`Party Size: ${partySize}`));
        if (tableTypes?.length) {
          console.log(chalk.white(`Table Types: ${tableTypes.join(', ')}`));
        }
        console.log('');

        let slots = await client.findAvailableSlots(options.venue, options.date, partySize);
        slots = client.filterSlotsByTableType(slots, tableTypes);
        const filtered = client.filterSlotsByTime(slots, config.preferredTimes);
        displaySlots(filtered.length > 0 ? filtered : slots);
      } else {
        // Check all configured venues
        for (const venue of config.venues) {
          const partySize = venue.partySize || config.defaultPartySize;
          const tableTypes = venue.preferredTableTypes || config.preferredTableTypes;
          console.log(chalk.white.bold(`📍 ${venue.name}`));
          console.log(chalk.gray(`   Date: ${venue.date} | Party: ${partySize}`));
          if (tableTypes?.length) {
            console.log(chalk.gray(`   Table types: ${tableTypes.join(', ')}`));
          }

          let slots = await client.findAvailableSlots(venue.id, venue.date, partySize);
          slots = client.filterSlotsByTableType(slots, tableTypes);
          const times = venue.preferredTimes || config.preferredTimes;
          const filtered = client.filterSlotsByTime(slots, times);
          displaySlots(filtered.length > 0 ? filtered : slots);
          console.log('');
        }
      }
    });
  });

// Book command - find and book first matching slot
program
  .command('book')
  .description('Find and book the first available matching slot')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --venue <id>', 'Venue ID to book', parseInt)
  .option('-d, --date <date>', 'Date to book (YYYY-MM-DD)')
  .option('-p, --party-size <size>', 'Party size', parseInt)
  .option('-t, --time <time>', 'Preferred time (e.g., 19:00)')
  .option('-T, --table-type <type>', 'Preferred table type (e.g., "Table", "Bar Seats")')
  .option('--dry-run', 'Check availability without booking')
  .option('-s, --start-at <datetime>', 'Schedule start time (e.g., "18:00" or "2026-01-15 18:00")')
  .action(async (options) => {
    printBanner();
    const config = loadConfig(options.config);
    
    await executeWithSchedule(options.startAt, config, async () => {
      const client = new ResyClient(config.apiKey, config.email, config.password);

      console.log(chalk.cyan('📞 Attempting to book reservation...\n'));

      if (options.dryRun) {
        console.log(chalk.yellow('⚠ DRY RUN MODE - Will not actually book\n'));
      }

      // Authenticate first
      const authenticated = await client.authenticate();
      if (!authenticated) {
        process.exit(1);
      }

      console.log('');

      const venues = options.venue && options.date
        ? [{ id: options.venue, name: `Venue ${options.venue}`, date: options.date, partySize: options.partySize, preferredTimes: options.time ? [options.time] : undefined, preferredTableTypes: options.tableType ? [options.tableType] : undefined }]
        : config.venues;

      for (const venue of venues) {
        const partySize = venue.partySize || options.partySize || config.defaultPartySize;
        const preferredTime = options.time ? [options.time] : (venue.preferredTimes || config.preferredTimes);
        const tableTypes = options.tableType ? [options.tableType] : (venue.preferredTableTypes || config.preferredTableTypes);

        console.log(chalk.white.bold(`📍 ${venue.name}`));

        let slots = await client.findAvailableSlots(venue.id, venue.date, partySize);
        
        if (slots.length === 0) {
          console.log(chalk.yellow('  No slots available.\n'));
          continue;
        }

        // Filter by table type first
        slots = client.filterSlotsByTableType(slots, tableTypes);
        if (slots.length === 0) {
          console.log(chalk.yellow('  No slots matching preferred table types.\n'));
          continue;
        }

        const filtered = client.filterSlotsByTime(slots, preferredTime);
        const targetSlots = filtered.length > 0 ? filtered : slots;

        if (targetSlots.length === 0) {
          console.log(chalk.yellow('  No matching slots for preferred times.\n'));
          continue;
        }

        const slot = targetSlots[0];
        console.log(chalk.cyan(`  Found slot: ${slot.time} - ${slot.type}`));

        if (options.dryRun) {
          console.log(chalk.yellow('  ⚠ Skipping actual booking (dry run)\n'));
          continue;
        }

        console.log(chalk.cyan('  Booking...'));
        const result = await client.bookReservation(slot);

        if (result.success) {
          console.log(chalk.green.bold(`\n🎉 SUCCESS! Reservation booked!`));
          console.log(chalk.green(`   ${result.venueName}`));
          console.log(chalk.green(`   ${result.date} at ${result.time}`));
          console.log(chalk.green(`   Party of ${result.partySize}`));
          console.log(chalk.green(`   Confirmation: ${result.reservationId}\n`));
          process.exit(0);
        } else {
          console.log(chalk.red(`  ✗ Booking failed: ${result.error}\n`));
        }
      }

      console.log(chalk.yellow('No reservations were booked.'));
    });
  });

// Snipe command - continuously monitor and book when available
program
  .command('snipe')
  .description('Continuously monitor and auto-book when a slot becomes available')
  .option('-c, --config <path>', 'Path to config file')
  .option('-i, --interval <seconds>', 'Check interval in seconds', parseInt, 30)
  .option('-m, --max-attempts <count>', 'Maximum number of attempts', parseInt)
  .option('--dry-run', 'Check availability without booking')
  .option('-s, --start-at <datetime>', 'Schedule start time (e.g., "18:00" or "2026-01-15 18:00")')
  .action(async (options) => {
    printBanner();
    const config = loadConfig(options.config);
    
    await executeWithSchedule(options.startAt, config, async () => {
      const client = new ResyClient(config.apiKey, config.email, config.password);
      const scheduler = new ResyScheduler(client);

      // Authenticate first
      const authenticated = await client.authenticate();
      if (!authenticated) {
        process.exit(1);
      }

      console.log(chalk.cyan('\nTarget restaurants:'));
      for (const venue of config.venues) {
        const partySize = venue.partySize || config.defaultPartySize;
        const times = venue.preferredTimes || config.preferredTimes;
        const tableTypes = venue.preferredTableTypes || config.preferredTableTypes;
        console.log(chalk.white(`  • ${venue.name}`));
        console.log(chalk.gray(`    Date: ${venue.date} | Party: ${partySize}`));
        if (times?.length) {
          console.log(chalk.gray(`    Preferred times: ${times.join(', ')}`));
        }
        if (tableTypes?.length) {
          console.log(chalk.gray(`    Table types: ${tableTypes.join(', ')}`));
        }
      }

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nReceived interrupt signal...'));
        scheduler.stop();
        process.exit(0);
      });

      await scheduler.snipe(
        config.venues,
        config.defaultPartySize,
        config.preferredTimes,
        config.preferredTableTypes,
        {
          intervalSeconds: options.interval,
          maxAttempts: options.maxAttempts,
          dryRun: options.dryRun,
        }
      );
    });
  });

program.parse();

