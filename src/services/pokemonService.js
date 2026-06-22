import * as pokemonRepository from '../repositories/pokemonRepository.js';
import { config } from '../config/index.js';

/**
 * "mr-mime" -> "Mr Mime"
 */
const formatName = (name) => {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatStatName = (name) => {
  const statNames = {
    hp: 'HP',
    attack: 'Attack',
    defense: 'Defense',
    'special-attack': 'Sp. Atk',
    'special-defense': 'Sp. Def',
    speed: 'Speed'
  };
  return statNames[name] || formatName(name);
};

/**
 * Transform raw PokeAPI data into a display-ready object.
 */
const formatPokemonData = (pokemon, species = null) => {
  const description =
    species?.flavor_text_entries
      ?.find((entry) => entry.language.name === 'en')
      ?.flavor_text?.replace(/[\f\n\r]/g, ' ') || 'No description available.';

  const genus = species?.genera?.find((g) => g.language.name === 'en')?.genus || 'Unknown';

  const stats = pokemon.stats.map((s) => ({
    name: formatStatName(s.stat.name),
    value: s.base_stat
  }));

  const totalStats = stats.reduce((sum, s) => sum + s.value, 0);

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: formatName(pokemon.name),

    image:
      pokemon.sprites?.other?.['official-artwork']?.front_default ||
      pokemon.sprites?.front_default ||
      '',
    sprite: pokemon.sprites?.front_default || '',

    types: pokemon.types.map((t) => t.type.name),

    height: pokemon.height / 10, // decimeters -> meters
    weight: pokemon.weight / 10, // hectograms -> kilograms

    abilities: pokemon.abilities.map((a) => ({
      name: formatName(a.ability.name),
      isHidden: a.is_hidden
    })),

    stats,
    totalStats,

    description,
    genus,
    color: species?.color?.name || 'gray',
    captureRate: species?.capture_rate || 0,
    baseHappiness: species?.base_happiness || 0
  };
};

/**
 * Get a single, fully-formatted Pokemon. Returns null if not found.
 */
export const getPokemonDetails = async (nameOrId) => {
  const pokemon = await pokemonRepository.getPokemonByNameOrId(nameOrId);
  if (!pokemon) {
    return null; // Not found
  }

  let species = null;
  try {
    species = await pokemonRepository.getPokemonSpecies(pokemon.id);
  } catch {
    // Species data is optional - continue without it.
  }

  return formatPokemonData(pokemon, species);
};

/**
 * Paginated list of Pokemon with full details for each entry.
 */
export const getAllPokemon = async (page = 1, limit = config.pagination.defaultLimit) => {
  const offset = (page - 1) * limit;
  const data = await pokemonRepository.getAllPokemon(limit, offset);

  const pokemonWithDetails = await Promise.all(
    data.results.map((pokemon) => getPokemonDetails(pokemon.name))
  );

  return {
    pokemon: pokemonWithDetails.filter((p) => p !== null),
    totalCount: data.count,
    currentPage: page,
    totalPages: Math.ceil(data.count / limit),
    hasNextPage: offset + limit < data.count,
    hasPrevPage: page > 1
  };
};

/**
 * Search by name. Tries an exact match first, then a partial-name search.
 */
export const searchPokemon = async (query) => {
  if (!query || query.trim().length === 0) {
    return { pokemon: [], totalCount: 0 };
  }

  const exactMatch = await pokemonRepository.getPokemonByNameOrId(query);
  if (exactMatch) {
    const formatted = await getPokemonDetails(query);
    return {
      pokemon: formatted ? [formatted] : [],
      totalCount: formatted ? 1 : 0
    };
  }

  const searchResults = await pokemonRepository.searchPokemon(query);

  const pokemonWithDetails = await Promise.all(
    searchResults.results.slice(0, 20).map((pokemon) => getPokemonDetails(pokemon.name))
  );

  return {
    pokemon: pokemonWithDetails.filter((p) => p !== null),
    totalCount: searchResults.count
  };
};


/**
 * All selectable types (special types removed), formatted for display.
 */
export const getPokemonTypes = async () => {
  const types = await pokemonRepository.getPokemonTypes();

  return types
    .filter((t) => t.name !== 'unknown' && t.name !== 'shadow')
    .map((t) => ({ name: t.name, displayName: formatName(t.name) }));
};

/**
 * Paginated list of Pokemon for a given type. Returns null if type not found.
 */
export const getPokemonByType = async (
  typeName,
  page = 1,
  limit = config.pagination.defaultLimit
) => {
  const pokemonList = await pokemonRepository.getPokemonByType(typeName);
  if (!pokemonList) {
    return null; // Type not found
  }

  const offset = (page - 1) * limit;
  const paginatedList = pokemonList.slice(offset, offset + limit);

  const pokemonWithDetails = await Promise.all(
    paginatedList.map((pokemon) => getPokemonDetails(pokemon.name))
  );

  return {
    pokemon: pokemonWithDetails.filter((p) => p !== null),
    type: typeName,
    totalCount: pokemonList.length,
    currentPage: page,
    totalPages: Math.ceil(pokemonList.length / limit),
    hasNextPage: offset + limit < pokemonList.length,
    hasPrevPage: page > 1
  };
};

