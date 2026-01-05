# Resy Reservation Tool

A CLI tool to check and book restaurant reservations on Resy. Perfect for snagging hard-to-get reservations at popular restaurants.

## Features

- **Check availability** - View available reservation slots
- **Auto-book** - Automatically book the first matching slot
- **Snipe mode** - Continuously monitor and book when a slot opens up
- **Time preferences** - Filter by preferred dining times
- **Multi-venue support** - Monitor multiple restaurants at once

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

1. Copy the example config file:
   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` with your Resy credentials and target restaurants:
   ```json
   {
     "email": "your-email@example.com",
     "password": "your-resy-password",
     "apiKey": "YOUR_RESY_API_KEY",
     "defaultPartySize": 2,
     "preferredTimes": ["19:00", "19:30", "20:00"],
     "venues": [
       {
         "id": 12345,
         "name": "Restaurant Name",
         "date": "2026-02-14"
       }
     ]
   }
   ```

### Getting Your API Key

1. Open [resy.com](https://resy.com) in your browser
2. Open Developer Tools (F12) → Network tab
3. Search for any restaurant and look at the network requests
4. Find a request to `api.resy.com` and look for the `Authorization` header
5. The API key is the value after `ResyAPI api_key="`

### Finding Venue IDs

1. Go to a restaurant's page on resy.com
2. Look at the URL: `https://resy.com/cities/ny/restaurant-name?seats=2&date=2026-01-15`
3. Open Network tab and search for reservations
4. The venue ID will be in the API request parameters

## Usage

### Check Available Slots

```bash
# Check all configured venues
npm run check

# Or using the CLI directly
node dist/index.js check

# Check specific venue
node dist/index.js check --venue 12345 --date 2026-02-14 --party-size 2
```

### Book a Reservation

```bash
# Book first available matching slot
npm run book

# Dry run (check without booking)
node dist/index.js book --dry-run

# Book specific venue
node dist/index.js book --venue 12345 --date 2026-02-14 --time 19:00
```

### Snipe Mode (Continuous Monitoring)

```bash
# Start sniping with default 30-second interval
npm run snipe

# Custom interval (check every 10 seconds)
node dist/index.js snipe --interval 10

# Limit attempts
node dist/index.js snipe --interval 10 --max-attempts 100

# Dry run mode
node dist/index.js snipe --dry-run
```

Press `Ctrl+C` to stop the sniper.

## CLI Options

```
Usage: resy [command] [options]

Commands:
  check   Check available reservation slots
  book    Find and book the first available matching slot
  snipe   Continuously monitor and auto-book when a slot becomes available

Common Options:
  -c, --config <path>     Path to config file (default: ./config.json)
  -v, --venue <id>        Venue ID
  -d, --date <date>       Date (YYYY-MM-DD)
  -p, --party-size <n>    Party size
  --dry-run               Check availability without booking

Snipe Options:
  -i, --interval <sec>    Check interval in seconds (default: 30)
  -m, --max-attempts <n>  Maximum number of attempts
```

## Tips for Birthday Reservations

1. **Know when reservations open** - Most restaurants release reservations 2-4 weeks in advance at midnight or 9-10 AM
2. **Use snipe mode** - Start the sniper a few minutes before reservations open
3. **Set preferred times** - Be flexible with a range of times to increase your chances
4. **Monitor multiple venues** - Add backup restaurants to your config
5. **Use a short interval** - During peak times, check every 5-10 seconds

## Security Notes

- Your `config.json` is gitignored to protect your credentials
- Auth tokens are cached locally in `.resy-token` (also gitignored)
- Never commit your API key or password to version control

## Troubleshooting

**Authentication failed**
- Double-check your email and password
- Ensure your API key is correct
- Try logging into resy.com manually first

**No slots found**
- Verify the venue ID is correct
- Check if the date is within the restaurant's booking window
- Try removing preferred times to see all available slots

**Booking failed**
- Ensure you have a valid payment method on your Resy account
- The slot may have been taken by another user
- Check for any deposit or cancellation fees

## License

MIT

