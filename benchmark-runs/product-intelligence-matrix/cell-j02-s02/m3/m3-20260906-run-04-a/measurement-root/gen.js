/* LOCI data generator — deterministic, no dependencies.
 * Exposes window.LOCI_GEN.generate() (also attachable in Node via globalThis
 * for offline verification harnesses). */
(function (g) {
  'use strict';

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DOMAINS = [
    { name: 'Climate & Atmosphere', cats: ['Temperature Records', 'Precipitation', 'Aerosols & Air Quality', 'Reanalysis Grids'] },
    { name: 'Ocean & Hydrology',    cats: ['Sea Surface', 'Currents & Bathymetry', 'River Discharge', 'Groundwater'] },
    { name: 'Land & Ecology',       cats: ['Forest Cover', 'Biodiversity', 'Soils', 'Land Use'] },
    { name: 'Geospatial & Terrain', cats: ['Elevation Models', 'Satellite Imagery', 'Administrative Boundaries', 'Place Names'] },
    { name: 'Energy & Industry',    cats: ['Power Generation', 'Emissions', 'Mining & Materials', 'Supply Chains'] },
    { name: 'Society & Economy',    cats: ['Population & Demography', 'Household Income', 'Labor & Employment', 'Trade'] },
    { name: 'Health & Epidemiology',cats: ['Disease Surveillance', 'Facilities & Workforce', 'Vaccination', 'Nutrition'] },
    { name: 'Transport & Mobility', cats: ['Road Networks', 'Transit Ridership', 'Aviation', 'Maritime Traffic'] },
  ];

  const REGIONS = ['Amazon Basin','Sahel Belt','Ganges Delta','Andean Cordillera','Baltic Rim','Gulf of Mexico','Horn of Africa','Scandinavian North','Mekong Corridor','Great Lakes','Patagonian Steppe','Coral Triangle','Atlas Mountains','Siberian East','Caribbean Basin','Danube Basin','Kalimantan Interior','Rocky Mountain West','Nile Valley','Japanese Archipelago','Iberian Peninsula','East African Rift','Boreal Canada','Yangtze Basin','Levant Coast','Chihuahuan Desert','Alpine Europe','Deccan Plateau','La Plata Basin','Fennoscandian Coast'];

  const SUBJECTS = {
    'Temperature Records': ['Temperature Anomaly', 'Heatwave Frequency', 'Frost Days', 'Urban Heat Island', 'Growing Season Length'],
    'Precipitation': ['Monsoon Rainfall', 'Convective Storm Census', 'Hail Climatology', 'Snowfall Water Equivalent', 'Rain Gauge Density'],
    'Aerosols & Air Quality': ['Black Carbon', 'Ozone Column', 'PM2.5 Network', 'Dust Optical Depth', 'Smoke Plume Height'],
    'Reanalysis Grids': ['Radiative Flux', 'Cloud Optical Depth', 'Wind Reanalysis', 'Humidity Profile', 'Cyclone Tracks'],
    'Sea Surface': ['Sea Surface Temperature', 'Wave Height', 'Coral Bleaching Alert', 'Salinity Grid', 'Chlorophyll Bloom'],
    'Currents & Bathymetry': ['Drifter Trajectories', 'Tidal Gauge', 'Sediment Load', 'Estuarine Mixing', 'Seafloor Backscatter'],
    'River Discharge': ['Flood Extent', 'River Gauge Network', 'Sediment Yield', 'Snowpack Equivalent', 'Ice Jam Log'],
    'Groundwater': ['Aquifer Drawdown', 'Karst Spring Flow', 'Well Hydrograph', 'Recharge Estimate', 'Saline Intrusion Front'],
    'Forest Cover': ['Canopy Height', 'Deforestation Alert', 'Treeline Shift', 'Biomass Plot', 'Canopy Gap Census'],
    'Biodiversity': ['Species Range Shift', 'Pollinator Census', 'Termite Mound Density', 'Seed Dispersal', 'Amphibian Call Survey'],
    'Soils': ['Soil Carbon Stock', 'Peat Depth', 'Erosion Plot', 'Fungal Network Survey', 'pH Transect'],
    'Land Use': ['Wetland Inundation', 'Mangrove Extent', 'Cropland Intensity', 'Grazing Pressure', 'Wildfire Perimeter'],
    'Elevation Models': ['LiDAR Point Cloud', 'Sinkhole Inventory', 'Ridge Line', 'Cliff Retreat', 'Landslide Scar'],
    'Satellite Imagery': ['Building Footprint', 'Urban Impervious Surface', 'Nighttime Luminosity', 'Cloud-Free Mosaic', 'Shoreline Erosion'],
    'Administrative Boundaries': ['Settlement Extent', 'Electoral Precinct', 'Census Tract', 'Coastline Change', 'Municipal Merger Log'],
    'Place Names': ['Gazetteer Entries', 'Endonym Registry', 'Historical Name Variants', 'Field Name Census', 'Peak Designations'],
    'Power Generation': ['Wind Capacity Factor', 'Solar Irradiance', 'Hydro Reservoir Release', 'Geothermal Gradient', 'Battery Storage Dispatch'],
    'Emissions': ['Flare Volumes', 'Stack Plume Census', 'Methane Leak Survey', 'Fleet Fuel Burn', 'Cement Kiln Output'],
    'Mining & Materials': ['Smelter Throughput', 'Quarry Extent', 'Tailings Pond', 'Ore Grade Assay', 'Haul Road Dust'],
    'Supply Chains': ['Port Dwell Time', 'Warehouse Density', 'Transmission Congestion', 'District Heating Load', 'Grid Interconnection'],
    'Population & Demography': ['Migration Estimate', 'Age Structure Table', 'Birth Register', 'Commuter Shed', 'Household Composition'],
    'Household Income': ['Rent Index', 'Microloan Repayment', 'Remittance Flow', 'Market Price Basket', 'Utility Arrears'],
    'Labor & Employment': ['Payroll Census', 'Gig Platform Earnings', 'Apprenticeship Registry', 'Shift Vacancy Postings', 'Seasonal Hiring Index'],
    'Trade': ['Customs Declarations', 'Tariff Line Export', 'Container Throughput', 'Border Crossing Counts', 'Cold Storage Capacity'],
    'Disease Surveillance': ['Dengue Incidence', 'Tuberculosis Contact Trace', 'Malaria Vector Habitat', 'Norovirus Line List', 'Heat Morbidity'],
    'Facilities & Workforce': ['Clinic Density', 'Hospital Bed Turnover', 'Ambulance Response', 'Midwife Coverage', 'Pharmacy Stockout Log'],
    'Vaccination': ['Vaccine Vial Tracker', 'Cold Chain Break', 'Dose Timeliness', 'Booster Coverage', 'School Immunization Roll'],
    'Nutrition': ['Anemia Prevalence', 'Stunting Survey', 'Market Food Prices', 'School Meal Census', 'Micronutrient Panel'],
    'Road Networks': ['Road Centerline', 'Pavement Condition', 'Toll Plaza Count', 'Congestion Zone Entry', 'Wildlife Crossing Points'],
    'Transit Ridership': ['Bus Headway', 'Bike Share Trips', 'Fare Gate Counts', 'Paratransit Trips', 'Station Boardings'],
    'Aviation': ['Air Cargo Manifest', 'Runway Geometry', 'Terminal Dwell', 'Overflight Corridors', 'Diversion Log'],
    'Maritime Traffic': ['Port Call Sequence', 'Ferry Crossing', 'Container Dwell Time', 'Fishing Effort Grid', 'Anchorage Occupancy'],
  };

  const TYPES = ['Inventory','Observatory','Archive','Panel','Compendium','Time Series','Atlas','Registry','Sampling Grid','Ledger','Monitoring Set','Almanac','Catalogue','Benchmark','Survey','Digest'];

  const FORMATS = ['CSV','Parquet','GeoTIFF','NetCDF','JSON','HDF5','Shapefile','Zarr'];
  const LICENSES = ['CC0-1.0','CC-BY-4.0','ODbL-1.0','CC-BY-NC-4.0','Custom Terms'];
  const ACCESS = ['open','registration','gated'];
  const STEWARDS = ['Meridian Data Trust','Open Geosphere Lab','Civic Signal Cooperative','Terra Numerica Institute','Basin Observatories Union','Public Envelope Foundation','Continental Gridwatch','Helix Commons','Northline Archive','Estuary Metrics Group','Palewind Consortium','Cartographic Commons'];
  const SUFFIX = ['II','III','Extended','Snapshot','Composite','Synthesis','Reissue','Harmonized','Continued','Annex'];
  const TAGPOOL = ['long-term','quality-controlled','sensor','derived','raw','modeled','harmonized','open-access','gap-filled','citizen-science','peer-reviewed','near-real-time'];
  const QUALITY = ['station measurements','retrievals from multiple satellite passes','administrative records harmonized across years','field surveys with GPS-referenced plots','model output downscaled to 1 km','assimilated observations and reanalysis'];

  // Date bounds: 2024-01-01 .. 2026-09-05 (relative to a fixed "today" so
  // recency buckets stay meaningful and deterministic).
  const DAY = 86400000;
  const T0 = Date.UTC(2024, 0, 1);
  const T1 = Date.UTC(2026, 8, 5);

  function generate(N) {
    N = N || 1728;
    const rnd = mulberry32(20260908);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const items = [];
    const usedNames = new Set();

    let n = 0;
    outer:
    for (let round = 0; round < 60; round++) {
      for (let d = 0; d < DOMAINS.length; d++) {
        const dom = DOMAINS[d];
        for (let c = 0; c < dom.cats.length; c++) {
          if (n >= N) break outer;
          const subjectPool = SUBJECTS[dom.cats[c]];
          const subject = subjectPool[(round + Math.floor(rnd() * subjectPool.length)) % subjectPool.length];
          const region = pick(REGIONS);
          let name = region + ' ' + subject + ' ' + pick(TYPES);
          if (usedNames.has(name)) name = region + ' ' + subject + ' ' + pick(TYPES) + ', ' + pick(SUFFIX);
          if (usedNames.has(name)) continue;
          usedNames.add(name);

          const updated = new Date(T0 + Math.floor(rnd() * (T1 - T0)));
          const records = Math.floor(Math.pow(10, 3 + rnd() * 5.4));
          const sizeMB = Math.max(0.2, Math.round(records * (0.0004 + rnd() * 0.004) * 10) / 10);
          const nt = 3 + Math.floor(rnd() * 3);
          const tags = [];
          while (tags.length < nt) {
            const t = rnd() < 0.55 ? subject.split(' ')[0].toLowerCase() : pick(TAGPOOL);
            if (!tags.includes(t)) tags.push(t);
          }
          const fmt = pick(FORMATS);
          const access = rnd() < 0.62 ? 'open' : (rnd() < 0.7 ? 'registration' : 'gated');

          items.push({
            id: 'DS-' + String(n + 1).padStart(4, '0'),
            name: name,
            domain: dom.name,
            category: dom.cats[c],
            tags: tags,
            format: fmt,
            license: pick(LICENSES),
            access: access,
            records: records,
            sizeMB: sizeMB,
            updated: updated.toISOString().slice(0, 10),
            updatedTs: updated.getTime(),
            version: 'v' + (1 + Math.floor(rnd() * 9)) + '.' + Math.floor(rnd() * 10),
            steward: pick(STEWARDS),
            region: region,
            desc: 'Compilation of ' + subject.toLowerCase() + ' records for the ' + region + ', built from ' + pick(QUALITY) + '.',
          });
          n++;
        }
      }
    }
    return { items: items, domains: DOMAINS };
  }

  g.LOCI_GEN = { generate: generate };
})(typeof window !== 'undefined' ? window : globalThis);
