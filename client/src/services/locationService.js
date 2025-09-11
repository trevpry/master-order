class LocationService {
  constructor() {
    this.baseUrl = '/api/locations';
  }

  async getAllLocations(options = {}) {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch locations: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getLocationById(id) {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch location: ${response.statusText}`);
    }
    
    return response.json();
  }

  async createLocation(locationData) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create location: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateLocation(id, locationData) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update location: ${response.statusText}`);
    }
    
    return response.json();
  }

  async deleteLocation(id) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete location: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getFavoriteLocations() {
    const response = await fetch(`${this.baseUrl}/favorites`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch favorite locations: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getLocationsByType(type) {
    const response = await fetch(`${this.baseUrl}/type/${type}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch locations by type: ${response.statusText}`);
    }
    
    return response.json();
  }

  async searchNearby(latitude, longitude, radius = 10) {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
    });

    const response = await fetch(`${this.baseUrl}/nearby?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to search nearby locations: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getLocationStats() {
    const response = await fetch(`${this.baseUrl}/stats`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch location stats: ${response.statusText}`);
    }
    
    return response.json();
  }

  async toggleFavorite(id, isFavorite) {
    const response = await fetch(`${this.baseUrl}/${id}/favorite`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isFavorite }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to toggle favorite: ${response.statusText}`);
    }
    
    return response.json();
  }

  async connectToNote(locationId, noteId) {
    const response = await fetch(`${this.baseUrl}/${locationId}/connect-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ noteId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to connect location to note: ${response.statusText}`);
    }
    
    return response.json();
  }

  async disconnectFromNote(locationId) {
    const response = await fetch(`${this.baseUrl}/${locationId}/disconnect-note`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to disconnect location from note: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Geocoding utilities (using Nominatim - OpenStreetMap's geocoding service)
  async geocodeAddress(address) {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '5',
      addressdetails: '1',
    });

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }
      
      const results = await response.json();
      
      return results.map(result => ({
        display_name: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: {
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postalCode: result.address?.postcode,
        },
        type: result.type,
        importance: result.importance,
      }));
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async reverseGeocode(latitude, longitude) {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      addressdetails: '1',
    });

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        display_name: result.display_name,
        address: {
          street: result.address?.road,
          city: result.address?.city || result.address?.town || result.address?.village,
          state: result.address?.state,
          country: result.address?.country,
          postalCode: result.address?.postcode,
        },
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }
}

export default new LocationService();
