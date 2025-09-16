// Timezone debug utility - run this in browser console to test timezone handling
// Copy and paste this into the browser console to debug timezone issues

async function debugTimezone() {
  console.log('=== Timezone Debug ===');
  
  // Test current browser timezone
  const now = new Date();
  console.log('Current browser time:', now.toString());
  console.log('Current UTC time:', now.toUTCString());
  
  // Test Eddie Settings API
  try {
    const response = await fetch('/api/settings/eddie');
    const settings = await response.json();
    console.log('Eddie Settings timezone:', settings.timezone);
    
    // Test timezone formatting
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const todayString = formatter.format(now);
    console.log('Today in configured timezone:', todayString);
    
    // Test different timezones for comparison
    const utcFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    console.log('Today in UTC:', utcFormatter.format(now));
    
    const localFormatter = new Intl.DateTimeFormat('en-CA', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    console.log('Today in browser timezone:', localFormatter.format(now));
    
  } catch (error) {
    console.error('Error fetching Eddie Settings:', error);
  }
  
  console.log('=== End Debug ===');
}

// Call the function
debugTimezone();