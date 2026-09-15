/* Locus — deterministic inline dataset.
 * Generates 2,400 catalog items at boot (synchronous, seeded PRNG) so the first
 * paint is already the usable state. No fetch, no modules — safe over file://.
 */
(function () {
  "use strict";

  // mulberry32 — tiny seeded PRNG for fully deterministic output
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20260902);
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function pickN(arr, n) {
    var c = arr.slice(), out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
    return out;
  }
  function int(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

  var DOMAINS = [
    { id: "climate", name: "Climate & Weather",
      subcats: ["Temperature Records", "Precipitation", "Extreme Events", "Atmospheric Composition"],
      topics: ["Heat Island", "Monsoon Rainfall", "Cyclone Tracks", "Tropospheric Ozone", "Aerosol Optical Depth", "Frost Days", "Drought Indices", "Hail Climatology", "Jet Stream Anomalies", "Cloud Cover", "Snow Line", "Sea Surface Temperature"],
      tags: ["temperature", "satellite", "gridded", "station", "reanalysis", "extremes", "trends", "ocean", "arctic", "model-output"] },
    { id: "health", name: "Health & Epidemiology",
      subcats: ["Disease Surveillance", "Hospital Capacity", "Vaccination Coverage", "Health Workforce"],
      topics: ["Influenza-Like Illness", "Tuberculosis Screening", "Measles Outbreaks", "ICU Occupancy", "Nurse Staffing", "Polio Immunization", "Dengue Fever", "Antimicrobial Resistance", "Birth Records", "Clinic Visits"],
      tags: ["surveillance", "weekly", "clinical", "vaccines", "hospitals", "outbreak", "demographic", "public-health", "time-series", "who-region"] },
    { id: "geo", name: "Geospatial & Mapping",
      subcats: ["Elevation & Terrain", "Land Cover", "Administrative Boundaries", "Hydrography"],
      topics: ["Digital Elevation", "Forest Canopy", "Wetland Extent", "Municipal Boundaries", "River Networks", "Glacier Outlines", "Building Footprints", "Coastline Change", "Land Parcels", "Floodplain Mapping"],
      tags: ["raster", "vector", "shapefile", "openstreetmap", "sentinel", "landsat", "dem", "gis", "boundaries", "terrain"] },
    { id: "econ", name: "Economics & Finance",
      subcats: ["Trade & Tariffs", "Labor Markets", "Prices & Inflation", "Public Finance"],
      topics: ["Export Flows", "Wage Growth", "Consumer Prices", "Sovereign Debt", "Small-Business Openings", "Remittance Corridors", "Port Throughput", "Rent Index", "Customs Duties", "Job Vacancies"],
      tags: ["macro", "monthly", "prices", "trade", "labor", "gdp", "cpi", "survey", "panel", "oecd"] },
    { id: "energy", name: "Energy & Environment",
      subcats: ["Electricity Grid", "Emissions", "Renewables", "Fuel Prices"],
      topics: ["Solar Capacity", "Wind Farm Output", "CO2 Concentrations", "Grid Congestion", "Battery Storage", "Wholesale Power", "Methane Leaks", "EV Charging Points", "District Heating", "Air Quality"],
      tags: ["emissions", "renewables", "grid", "hourly", "sensor-network", "co2", "power", "pm25", "meters", "weather-dependent"] },
    { id: "transport", name: "Transport & Mobility",
      subcats: ["Road Traffic", "Public Transit", "Aviation", "Maritime"],
      topics: ["Congestion Index", "Bus Ridership", "Flight Delays", "Container Shipments", "Bike-Share Trips", "Rail Punctuality", "Ferry Crossings", "Truck Tolls", "Parking Occupancy", "Road Safety"],
      tags: ["mobility", "gps-traces", "ridership", "real-time", "gtfs", "ais", "traffic", "transit", "origin-destination", "peak-hours"] },
    { id: "agri", name: "Agriculture & Land Use",
      subcats: ["Crop Yields", "Soil & Water", "Livestock", "Forestry"],
      topics: ["Wheat Yields", "Irrigation Rights", "Cattle Inventories", "Timber Harvest", "Pesticide Use", "Aquifer Levels", "Honey Production", "Cover Cropping", "Organic Certification", "Seed Banks"],
      tags: ["agriculture", "yields", "soil", "irrigation", "remote-sensing", "farms", "livestock", "forestry", "ndvi", "census"] },
    { id: "demo", name: "Demographics & Society",
      subcats: ["Population & Housing", "Education", "Migration", "Crime & Safety"],
      topics: ["Census Counts", "School Enrollment", "Net Migration", "Incident Reports", "Age Pyramids", "University Access", "Housing Vacancy", "Library Visits", "Voter Rolls", "Nonprofit Registers"],
      tags: ["census", "population", "households", "education", "migration", "administrative", "annual", "registers", "survey", "small-area"] }
  ];

  var QUALIFIERS = ["Quarterly", "Monthly", "Annual", "Global", "Regional", "National", "Municipal", "Historical", "Projected", "Continental", "Decadal", "Sentinel-Derived"];
  var SUFFIXES = ["Dataset", "Records", "Archive", "Registry", "Profiles", "Statistics", "Monitor", "Compendium", "Atlas", "Ledger", "Panels", "Collection"];
  var FORMATS = ["CSV", "JSON", "Parquet", "GeoJSON", "XML", "NetCDF"];
  var LICENSES = ["CC-BY-4.0", "CC0-1.0", "ODbL-1.0", "CC-BY-SA-4.0"];
  var ORGS = ["Open Data Commons Stewards", "GeoAnalytics Institute", "Civic Data Trust", "Meridian Research Lab", "Polygon Works", "Aurora Data Cooperative"];
  var USES = ["trend analysis", "policy research", "machine-learning pipelines", "public dashboards", "academic citation", "operational planning"];
  var FREQS = ["monthly", "quarterly", "annually", "weekly", "daily"];

  // Hand-placed named targets used by acceptance validation — reachable in ≤3 interactions.
  var NAMED = [
    { name: "Global Glacier Mass Balance Atlas", domain: "geo", sub: "Elevation & Terrain", tags: ["glaciers", "climate", "raster", "terrain"], desc: "Area and volume change for 210,000 glaciers, compiled from stereo imagery and field geodesy; the reference locate target for this collection." },
    { name: "Night-Time Lights Compendium", domain: "geo", sub: "Land Cover", tags: ["satellite", "viirs", "raster", "urbanization"], desc: "Annual cloud-free radiance composites tracing electrification and urban growth since 2012." },
    { name: "Urban Mobility Freedom Index", domain: "transport", sub: "Public Transit", tags: ["mobility", "ranking", "transit", "cities"], desc: "Composite score of affordability, reach and frequency for 480 metro transit systems." },
    { name: "Coastal Flood Exposure Register", domain: "climate", sub: "Extreme Events", tags: ["extremes", "coastal", "risk", "gridded"], desc: "Population and asset exposure within projected storm-surge envelopes for every coastline segment." },
    { name: "Hospital Bed Capacity Watch", domain: "health", sub: "Hospital Capacity", tags: ["hospitals", "capacity", "weekly", "clinical"], desc: "Bed, staffing and ventilator utilisation reported by 61 national health systems." },
    { name: "Wholesale Power Price Ledger", domain: "energy", sub: "Fuel Prices", tags: ["power", "prices", "hourly", "market"], desc: "Nodal day-ahead and real-time prices across 14 market operators, harmonised to UTC." },
    { name: "Global Wheat Yield Trials", domain: "agri", sub: "Crop Yields", tags: ["yields", "agriculture", "trials", "remote-sensing"], desc: "Field-trial yields for 3,900 wheat cultivars with soil and weather covariates." },
    { name: "City Rental Affordability Panels", domain: "econ", sub: "Prices & Inflation", tags: ["prices", "housing", "panel", "cities"], desc: "Median rents against household income percentiles for 210 cities, 2005–present." },
    { name: "Airbnb-Style Short-Term Rental Census", domain: "demo", sub: "Population & Housing", tags: ["housing", "administrative", "annual", "cities"], desc: "Licensed short-term rental units by dwelling type and neighbourhood." },
    { name: "Port Call & Berth Dwell Times", domain: "transport", sub: "Maritime", tags: ["ais", "shipping", "real-time", "ports"], desc: "Arrival, berth and departure timestamps for 2.1M vessel calls derived from AIS." },
    { name: "Methane Super-Emitter Events", domain: "energy", sub: "Emissions", tags: ["emissions", "satellite", "methane", "extremes"], desc: "Detection, plume estimate and attribution for satellite-observed methane release events." },
    { name: "School Segmentation Explorer", domain: "demo", sub: "Education", tags: ["education", "small-area", "annual", "equity"], desc: "Composition and segregation indices for every primary school attendance zone." },
    { name: "Aquifer Depletion Stress Index", domain: "agri", sub: "Soil & Water", tags: ["irrigation", "water", "gridded", "trends"], desc: "Groundwater table trends and abstraction rights merged into a single stress index." },
    { name: "Flight Delay Causal Breakdown", domain: "transport", sub: "Aviation", tags: ["aviation", "delays", "time-series", "real-time"], desc: "Delay minutes attributed to carrier, weather, airspace and cascade causes per route." },
    { name: "Wildland-Urban Interface Footprints", domain: "geo", sub: "Land Cover", tags: ["boundaries", "risk", "raster", "forestry"], desc: "Building-density intersection with wildland fuels, refreshed each fire season." },
    { name: "Vaccine Confidence Survey Series", domain: "health", sub: "Vaccination Coverage", tags: ["vaccines", "survey", "time-series", "public-health"], desc: "Rolling cross-national attitudes toward routine immunisation with stated determinants." }
  ];

  var items = [];
  var TOTAL = 2400;
  var namedByIdx = {};
  // spread named targets through the collection at deterministic positions
  for (var n = 0; n < NAMED.length; n++) namedByIdx[Math.floor((n + 0.5) * TOTAL / NAMED.length)] = NAMED[n];

  var byName = {};
  NAMED.forEach(function (x) { byName[x.name.toLowerCase()] = 1; });

  for (var i = 0; i < TOTAL; i++) {
    var dom = DOMAINS[i % DOMAINS.length];
    var named = namedByIdx[i];
    var sub = named ? named.sub : dom.subcats[i % dom.subcats.length];
    var topic = named ? null : pick(dom.topics);
    var name;
    if (named) {
      name = named.name;
    } else {
      var variant = rnd();
      name = variant < 0.45
        ? pick(QUALIFIERS) + " " + topic + " " + pick(SUFFIXES)
        : variant < 0.8
          ? topic + " — " + pick(QUALIFIERS) + " " + pick(SUFFIXES)
          : pick(QUALIFIERS) + " " + pick(dom.tags).replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + " " + pick(SUFFIXES);
      var k = 2, base = name;
      while (byName[name.toLowerCase()]) name = base + " " + (k++);
      byName[name.toLowerCase()] = 1;
    }
    var tags = named ? named.tags.slice() : pickN(dom.tags, int(3, 5));
    var dinfo = DOMAINS.filter(function (d) { return d.id === (named ? named.domain : dom.id); })[0];
    var year = int(2019, 2026), month = int(0, 11);
    var updated = new Date(Date.UTC(year, month, int(1, 28)));
    var rec = {
      id: "DS-" + (10000 + i),
      name: name,
      domain: dinfo.name,
      domainId: dinfo.id,
      subcategory: sub,
      tags: tags,
      formats: pickN(FORMATS, int(1, 3)),
      license: pick(LICENSES),
      sizeMB: Math.round(Math.exp(rnd() * 7 + 0.3) * 10) / 10,
      records: int(1, 900) * int(1000, 90000),
      updated: updated.toISOString().slice(0, 10),
      version: "v" + int(1, 9) + "." + int(0, 9),
      maintainer: pick(ORGS),
      description: named ? named.desc
        : topic + " observations for " + pick(["national", "regional", "municipal", "global"]) +
          " audiences, aggregated " + pick(FREQS) + " across " + int(12, 900) +
          " measured series; suitable for " + pick(USES) + "."
    };
    items.push(rec);
  }

  window.LOCUS_META = {
    total: items.length,
    domains: DOMAINS,
    formats: FORMATS,
    licenses: LICENSES,
    generated: "deterministic seed 20260902"
  };
  window.LOCUS_ITEMS = items;
})();
