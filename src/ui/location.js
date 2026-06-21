import tzlookup from 'tz-lookup';

function getCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => {
        const messages = {
          1: 'Location permission was denied.',
          2: 'Your location could not be determined.',
          3: 'The location request timed out.',
        };
        reject(new Error(messages[error.code] ?? 'Could not get your location.'));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  });
}

async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const { address = {} } = data;
  const place =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county;
  const region = address.state ?? address.country;

  if (place && region) return `${place}, ${region}`;
  return place ?? region ?? null;
}

export async function locateUser() {
  const coords = await getCoordinates();
  const timezone = tzlookup(coords.latitude, coords.longitude);

  if (!timezone) {
    throw new Error('Could not determine a timezone for your location.');
  }

  let placeName = null;
  try {
    placeName = await reverseGeocode(coords.latitude, coords.longitude);
  } catch {
    // Place name is optional — timezone is what matters for the watch.
  }

  return { timezone, placeName, coords };
}
