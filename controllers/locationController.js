// src/controllers/locationController.js
import Location from '../models/Location.js';
import { 
  createLocation, 
  searchLocations, 
  getLocationsByZone, 
  isLocationAvailable,
  toggleLocationStatus,
  getNearbyLocations
} from '../services/locationService.js';

export async function createLocationController(req, res) {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const location = await createLocation({ ...req.body, tenantId });
    res.status(201).json(location);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


export async function getLocations(req, res) {
  try {
    const { zone, search, sortBy = 'code' } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    let locations;
    if (search) {
      locations = await searchLocations(search, tenantId);
    } else if (zone) {
      locations = await getLocationsByZone(zone, tenantId);
    } else {
      locations = await Location.find({ tenantId, isActive: true }).sort({ code: 1 });
    }
    
    res.json(locations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getLocationByCode(req, res) {
  try {
    const { code } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const location = await Location.findOne({ tenantId, code, isActive: true });
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json(location);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}


export async function checkLocationAvailability(req, res) {
  try {
    const { code } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const available = await isLocationAvailable(code, tenantId);
    res.json({ available, code });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateLocationStatus(req, res) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const location = await toggleLocationStatus(id, isActive, tenantId);
    res.json(location);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getLocationsNearby(req, res) {
  try {
    const { code } = req.params;
    const { radius = 5 } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in user' });
    }
    
    const locations = await getNearbyLocations(code, parseInt(radius), tenantId);
    res.json(locations);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

