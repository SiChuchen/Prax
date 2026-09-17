/* DataAtlas — deterministic synthetic dataset registry.
 *
 * buildRegistry(seed) constructs the full item list from a seeded PRNG
 * (mulberry32), so the catalog is identical on every load and machine.
 * window.DATASETS is the canonical seed-20260902 build.
 *
 * Everything here runs synchronously at script-parse time, so the catalog
 * is complete before first paint — the app never shows a loading state.
 */
(function (global) {
  "use strict";

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), t | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SCOPES = ["Global", "Regional", "National", "Historical"];
  const FORMS = ["Daily Observations", "Monthly Time Series", "Annual Panel", "Station Registry", "Gridded Archive", "Indicator Database"];
  const FORMATS = ["CSV", "CSV", "CSV", "CSV", "JSON", "JSON", "Parquet", "Parquet", "GeoJSON", "XLSX"];   // weighted
  const LICENSES = ["CC-BY-4.0", "CC-BY-4.0", "CC-BY-4.0", "CC0", "CC0", "ODbL", "ODbL", "Custom (open)"]; // weighted
  const CADENCES = ["daily", "weekly", "monthly", "quarterly"];
  const REGION = { Global: "global", Regional: "multi-country", National: "country-level", Historical: "long-run" };

  const DETAILS = [
    "Aggregated from {n} monitoring stations and released on a {cadence} cadence.",
    "Compiled from {n} reporting entities with automated quality checks at ingest.",
    "Normalized to a common schema and joined to a geographic code lookup of {n} rows.",
    "Derived from {n} source records after deduplication and geocoding.",
    "Refreshed {cadence}; every release is archived and versioned for reproducibility.",
    "Contains {n} validated series with documented gaps and revision flags."
  ];

  // 8 domains × 5 collections × 18–29 items ≈ 940 items.
  const TREE = [
    {
      domain: "Climate & Weather",
      orgs: ["Copernicus Climate Service", "NOAA National Centers", "ECMWF", "Met Office", "World Meteorological Organization"],
      subcats: [
        { name: "Air Quality", subjects: ["PM2.5 Concentrations", "Tropospheric Ozone", "NO2 Emissions", "Aerosol Optical Depth", "Pollen and Allergens"], tags: ["air quality", "pollution", "atmosphere"] },
        { name: "Temperature & Heat", subjects: ["Surface Temperature Anomalies", "Urban Heat Island Intensity", "Marine Heatwaves", "Frost Day Counts", "Growing Season Length"], tags: ["temperature", "heat", "climate"] },
        { name: "Precipitation & Hydrology", subjects: ["Rainfall Gauge Measurements", "River Discharge", "Groundwater Levels", "Snow Water Equivalent", "Drought Indices"], tags: ["precipitation", "hydrology", "water"] },
        { name: "Storms & Extreme Events", subjects: ["Tornado Tracks", "Tropical Cyclone Tracks", "Hail Event Reports", "Lightning Flash Density", "Wildfire Perimeters"], tags: ["storms", "extremes", "hazards"] },
        { name: "Climate Indicators", subjects: ["Sea Ice Extent", "Glacier Mass Balance", "Ocean Heat Content", "Atmospheric CO2", "Mean Sea Level"], tags: ["indicators", "monitoring", "climate change"] }
      ]
    },
    {
      domain: "Health",
      orgs: ["World Health Organization", "ECDC", "US CDC", "OECD Health Division", "IHME"],
      subcats: [
        { name: "Disease Surveillance", subjects: ["Influenza-like Illness", "Tuberculosis Notifications", "Measles Cases", "Malaria Incidence", "Antimicrobial Resistance"], tags: ["surveillance", "epidemiology", "disease"] },
        { name: "Healthcare Facilities", subjects: ["Hospital Locations", "ICU Capacity", "Primary Care Clinics", "Emergency Response Units", "Pharmacy Directory"], tags: ["facilities", "hospitals", "capacity"] },
        { name: "Nutrition & Food Safety", subjects: ["Food Composition Tables", "Child Stunting Prevalence", "Foodborne Outbreaks", "Salt Intake Surveys", "Breastfeeding Indicators"], tags: ["nutrition", "food safety", "diet"] },
        { name: "Pharmaceuticals", subjects: ["Medicine Prices", "Antibiotic Consumption", "Vaccine Coverage", "Drug Shortage Reports", "Clinical Trial Registrations"], tags: ["pharma", "medicine", "vaccines"] },
        { name: "Vital Statistics", subjects: ["Birth Records", "Mortality by Cause", "Life Tables", "Infant Mortality", "Maternal Mortality"], tags: ["vital statistics", "mortality", "births"] }
      ]
    },
    {
      domain: "Economy & Finance",
      orgs: ["World Bank", "Eurostat", "IMF", "OECD", "UN Comtrade"],
      subcats: [
        { name: "Trade & Commerce", subjects: ["Merchandise Trade Flows", "Services Trade", "Tariff Schedules", "Export Market Penetration", "Customs Declarations"], tags: ["trade", "exports", "imports"] },
        { name: "Labor & Employment", subjects: ["Unemployment Rates", "Job Vacancies", "Wage Distribution", "Labor Force Participation", "Collective Bargaining Coverage"], tags: ["labor", "employment", "wages"] },
        { name: "Prices & Inflation", subjects: ["Consumer Price Index", "Producer Prices", "Housing Price Index", "Purchasing Power Parities", "Food Price Monitoring"], tags: ["prices", "inflation", "cpi"] },
        { name: "Public Finance", subjects: ["Government Revenue", "Budget Execution", "Public Debt", "Subsidy Registers", "Tax Revenue by Base"], tags: ["fiscal", "budget", "debt"] },
        { name: "Business Demography", subjects: ["Firm Entrants and Exits", "Startup Formation", "Bankruptcy Filings", "Enterprise Size Structure", "Foreign Affiliates"], tags: ["business", "firms", "enterprise"] }
      ]
    },
    {
      domain: "Transport & Mobility",
      orgs: ["Eurocontrol", "ICAO", "US Bureau of Transportation Statistics", "IMO", "UITP"],
      subcats: [
        { name: "Road Traffic", subjects: ["Traffic Count Stations", "Road Casualties", "Congestion Indices", "Freight Corridor Volumes", "EV Charging Points"], tags: ["road", "traffic", "safety"] },
        { name: "Aviation", subjects: ["Flight Arrivals and Departures", "Airport Throughput", "Airspace Delays", "Passenger Origin-Destination", "Cargo Tonnage"], tags: ["aviation", "flights", "airports"] },
        { name: "Maritime & Ports", subjects: ["Vessel Movements", "Port Call Statistics", "Container Throughput", "Shipping Emissions", "Port Congestion"], tags: ["maritime", "shipping", "ports"] },
        { name: "Public Transit", subjects: ["Ridership by Line", "Service Reliability", "Fare System Data", "Fleet Inventory", "Accessibility Scores"], tags: ["transit", "ridership", "metro"] },
        { name: "Micromobility", subjects: ["Shared Bike Trips", "E-scooter Fleet Positions", "Bike Lane Usage", "Dock Station Status", "Walkability Indices"], tags: ["micromobility", "cycling", "scooter"] }
      ]
    },
    {
      domain: "Energy & Utilities",
      orgs: ["IEA", "IRENA", "US Energy Information Administration", "ENTSO-E", "IAEA"],
      subcats: [
        { name: "Power Generation", subjects: ["Plant-level Output", "Capacity by Fuel", "Outage Logs", "Interconnection Flows", "Curtailment Events"], tags: ["power", "generation", "plants"] },
        { name: "Grid & Transmission", subjects: ["Line Loading", "Balancing Energy", "Smart Meter Readings", "Blackout Records", "Grid Topology"], tags: ["grid", "transmission", "balancing"] },
        { name: "Energy Consumption", subjects: ["Household Electricity Use", "Industrial Demand", "Building Energy Certificates", "Final Consumption by Sector", "Peak Demand"], tags: ["consumption", "demand", "electricity"] },
        { name: "Renewables", subjects: ["Solar Irradiance", "Wind Farm Production", "Hydro Reservoir Levels", "Geothermal Capacity", "Bioenergy Feedstocks"], tags: ["renewables", "solar", "wind"] },
        { name: "Fuels & Emissions", subjects: ["Refinery Output", "Fuel Prices", "Power Sector CO2", "Methane Leak Reports", "Reactor Status"], tags: ["fuels", "emissions", "co2"] }
      ]
    },
    {
      domain: "Agriculture & Land",
      orgs: ["FAO", "USDA", "EC Joint Research Centre", "OECD Agriculture", "IFAD"],
      subcats: [
        { name: "Crop Production", subjects: ["Yield Estimates", "Planted Area", "Harvest Progress", "Grain Stocks", "Greenhouse Production"], tags: ["crops", "yield", "harvest"] },
        { name: "Livestock", subjects: ["Head Counts", "Slaughter Volumes", "Dairy Yields", "Feed Prices", "Animal Disease Outbreaks"], tags: ["livestock", "cattle", "dairy"] },
        { name: "Soil & Land Use", subjects: ["Soil Profiles", "Cropland Mapping", "Land Cover Change", "Irrigation Areas", "Degradation Assessments"], tags: ["soil", "land use", "irrigation"] },
        { name: "Forestry", subjects: ["Forest Inventory", "Timber Harvest", "Deforestation Alerts", "Protected Woodlands", "Urban Tree Canopy"], tags: ["forest", "timber", "deforestation"] },
        { name: "Fisheries & Aquaculture", subjects: ["Catch Records", "Fleet Registry", "Aquaculture Production", "Stock Assessments", "Illegal Fishing Sightings"], tags: ["fisheries", "catch", "aquaculture"] }
      ]
    },
    {
      domain: "Society & Demography",
      orgs: ["UN DESA", "Eurostat", "WorldPop", "IOM", "National Statistical Office"],
      subcats: [
        { name: "Population & Census", subjects: ["Census Counts", "Population Density Grid", "Age Structure", "Population Projections", "Household Projections"], tags: ["population", "census", "density"] },
        { name: "Migration", subjects: ["Migrant Flows", "Remittance Data", "Asylum Applications", "Internal Migration", "Diaspora Estimates"], tags: ["migration", "asylum", "remittances"] },
        { name: "Urbanization", subjects: ["City Boundaries", "Built-up Area Expansion", "Urban Green Space", "Commuting Zones", "Housing Density"], tags: ["urban", "cities", "built-up"] },
        { name: "Education", subjects: ["Enrollment Rates", "School Locations", "Learning Outcomes", "Teacher Ratios", "Adult Literacy"], tags: ["education", "schools", "enrollment"] },
        { name: "Households & Income", subjects: ["Income Distribution", "Poverty Rates", "Household Expenditure", "Social Protection Coverage", "Wealth Surveys"], tags: ["income", "poverty", "households"] }
      ]
    },
    {
      domain: "Science & Technology",
      orgs: ["NASA", "ESA", "OpenAlex", "ITU", "NIST"],
      subcats: [
        { name: "Research Outputs", subjects: ["Publication Records", "Citation Networks", "Open Access Shares", "Preprint Volumes", "Retraction Notices"], tags: ["research", "publications", "citations"] },
        { name: "Patents & Innovation", subjects: ["Patent Grants", "R&D Expenditure", "Technology Classes", "Inventor Mobility", "Trademark Filings"], tags: ["patents", "innovation", "rnd"] },
        { name: "Earth Observation", subjects: ["Satellite Imagery Index", "Land Surface Temperature", "Nighttime Lights", "Radar Interferometry", "Calibration Targets"], tags: ["satellite", "imagery", "observation"] },
        { name: "Computing Infrastructure", subjects: ["Supercomputer Rankings", "Data Center Registry", "Internet Outage Log", "Domain Registration Stats", "Latency Measurements"], tags: ["computing", "infrastructure", "internet"] },
        { name: "Telecommunications", subjects: ["Broadband Coverage", "Mobile Tower Locations", "Spectrum Licenses", "Speed Measurements", "Subscription Statistics"], tags: ["telecom", "broadband", "spectrum"] }
      ]
    }
  ];

  function buildRegistry(seed) {
    const rnd = mulberry32(seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };

    const items = [];
    for (const node of TREE) {
      for (const sub of node.subcats) {
        // Cartesian product scope × subject × form, shuffled; the anchor combo
        // (Global, first subject, first form) is always kept so every
        // collection has one predictable flagship dataset.
        const combos = [];
        for (const sc of SCOPES) for (const sj of sub.subjects) for (const fm of FORMS) combos.push([sc, sj, fm]);
        shuffle(combos);
        const ai = combos.findIndex((c) => c[0] === "Global" && c[1] === sub.subjects[0] && c[2] === FORMS[0]);
        if (ai > 0) { const t = combos[0]; combos[0] = combos[ai]; combos[ai] = t; }

        const want = 18 + Math.floor(rnd() * 12); // 18–29 items per collection
        const used = new Set();
        let made = 0;
        for (const combo of combos) {
          if (made >= want) break;
          const scope = combo[0], subject = combo[1], form = combo[2];
          const name = scope + " " + subject + " — " + form;
          if (used.has(name)) continue;
          used.add(name);
          made++;

          const endY = 2024 + int(0, 2);
          const startY = Math.min(int(1970, 2016), endY - 5);
          const records = Math.round(Math.pow(10, 3 + rnd() * 4.6) / 100) * 100;
          const sizeMB = Math.max(0.1, Math.round(records * (0.0002 + rnd() * 0.0025) * 10) / 10);
          const day = int(0, 923); // 2024-03-01 … 2026-09-10
          const updated = new Date(Date.UTC(2024, 2, 1) + day * 86400000).toISOString().slice(0, 10);
          const detail = pick(DETAILS)
            .replace("{n}", fmt(int(2, 92) * 100))
            .replace("{cadence}", pick(CADENCES));
          const desc = form + " of " + subject.toLowerCase() + " — " + REGION[scope] +
            " coverage " + startY + "–" + endY + ". " + detail;

          const subjTag = subject.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
          const tags = [...new Set([subjTag].concat(sub.tags, [scope.toLowerCase(), "open data"]))].slice(0, 5);

          items.push({
            id: "",
            name: name,
            domain: node.domain,
            subcat: sub.name,
            org: pick(node.orgs),
            desc: desc,
            tags: tags,
            format: pick(FORMATS),
            license: pick(LICENSES),
            sizeMB: sizeMB,
            records: records,
            updated: updated,
            version: int(1, 5) + "." + int(0, 9),
            downloads: Math.round(Math.pow(10, 2.2 + rnd() * 3.4))
          });
        }
      }
    }
    items.forEach((it, k) => { it.id = "DS-" + (1000 + k); });
    return items;
  }

  function fmt(n) { return n.toLocaleString("en-US"); }

  global.buildRegistry = buildRegistry;
  global.DATASETS = buildRegistry(20260902);
})(window);
