// src/services/locationService.js
import Location from '../models/Location.js';
import { isValidLocationCode, parseLocationCode } from '../utils/locationGenerator.js';

/**
 * Cria uma nova localização com código fornecido manualmente
 * @param {Object} locationData - Dados da localização
 * @returns {Promise<Location>} Localização criada
 */
export async function createLocation(locationData) {
  const { code, description, zone, tenantId } = locationData;
  
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  
  if (!code || !isValidLocationCode(code)) {
    throw new Error('Código da localização é obrigatório e deve ser válido');
  }
  
  // Verificar se o código já existe para este tenant
  const existingLocation = await Location.findOne({ tenantId, code });
  if (existingLocation) {
    throw new Error('Código de localização já existe para este tenant');
  }
  
  return await Location.create({
    tenantId,
    code: code.trim(),
    description,
    zone
  });
}


/**
 * Busca localizações por código parcial ou descrição
 * @param {string} searchTerm - Termo de busca
 * @returns {Promise<Location[]>} Localizações encontradas
 */
export async function searchLocations(searchTerm, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  
  if (!searchTerm) {
    return await Location.find({ tenantId, isActive: true }).sort({ code: 1 });
  }
  
  const regex = new RegExp(searchTerm, 'i');
  return await Location.find({
    tenantId,
    $or: [
      { code: regex },
      { description: regex },
      { zone: regex }
    ],
    isActive: true
  }).sort({ code: 1 });
}

/**
 * Busca localizações por zona
 * @param {string} zone - Nome da zona
 * @returns {Promise<Location[]>} Localizações da zona
 */
export async function getLocationsByZone(zone, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  return await Location.find({ tenantId, zone, isActive: true }).sort({ code: 1 });
}


/**
 * Verifica se uma localização existe e está ativa
 * @param {string} locationCode - Código da localização
 * @returns {Promise<boolean>} True se existir e estiver ativa
 */
export async function isLocationAvailable(locationCode, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  
  if (!isValidLocationCode(locationCode)) {
    return false;
  }
  
  const location = await Location.findOne({ 
    tenantId,
    code: locationCode, 
    isActive: true 
  });
  
  return !!location;
}

/**
 * Ativa/Desativa uma localização
 * @param {string} locationId - ID da localização
 * @param {boolean} isActive - Status ativo
 * @returns {Promise<Location>} Localização atualizada
 */
export async function toggleLocationStatus(locationId, isActive, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  
  return await Location.findOneAndUpdate(
    { _id: locationId, tenantId },
    { isActive },
    { new: true }
  );
}

/**
 * Busca localizações próximas (baseado em ordem alfabética)
 * @param {string} locationCode - Código de referência
 * @param {number} radius - Raio de busca (quantidade de posições)
 * @returns {Promise<Location[]>} Localizações próximas
 */
export async function getNearbyLocations(locationCode, radius = 5, tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID é obrigatório');
  }
  
  if (!isValidLocationCode(locationCode)) {
    return [];
  }
  
  const locations = await Location.find({ tenantId, isActive: true }).sort({ code: 1 });
  const currentIndex = locations.findIndex(loc => loc.code === locationCode);
  
  if (currentIndex === -1) {
    return [];
  }
  
  const startIndex = Math.max(0, currentIndex - radius);
  const endIndex = Math.min(locations.length - 1, currentIndex + radius);
  
  return locations.slice(startIndex, endIndex + 1);
}
