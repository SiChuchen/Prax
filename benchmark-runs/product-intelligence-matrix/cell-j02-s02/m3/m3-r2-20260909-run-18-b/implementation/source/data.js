"use strict";
/*
 * data.js — The Open Collection · Natural History Index
 * Deterministic, seeded generation of a large open-collection corpus.
 * Everything is materialized synchronously at script evaluation time, so the
 * first paint is the ready state (no loading, no fetch, works from file://).
 */
(function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(20260917);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pad4 = (n) => String(n).padStart(4, "0");

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const CONDITIONS = [
    "condition at intake: good",
    "condition at intake: fair",
    "condition at intake: fragile — handled with support",
    "condition at intake: stable, conserved 2019",
    "condition at intake: good, re-housed 2023",
  ];

  const COLLECTORS = [
    "E. Hartmann", "M. Okafor", "A. Lindqvist", "R. Castellanos", "J. Whitfield",
    "N. Petrova", "T. Nakamura", "S. Ferreira", "L. Ashworth", "C. Mensah",
    "H. Lindgren", "P. Dubois", "V. Iordanova", "G. Aalto", "D. Okonkwo",
    "F. Marchetti", "K. Sørensen", "B. Almeida", "W. Cheng", "I. Novák",
  ];

  const FIELD_LOCALITIES = [
    "Tring, Hertfordshire", "Danube Delta, Romania", "Mount Kinabalu, Borneo",
    "Faroe Islands", "Lake Baikal, Siberia", "Valparaíso, Chile",
    "Ngorongoro, Tanzania", "Kerala Backwaters, India", "Galápagos Archipelago, Ecuador",
    "Svalbard, Norway", "Okavango Delta, Botswana", "Yucatán Peninsula, Mexico",
    "Altai Mountains, Mongolia", "Tasmania, Australia", "Serengeti Plain, Tanzania",
    "Guiana Shield, Guyana", "Sikhote-Alin, Russia", "Scottish Highlands",
    "Atlas Mountains, Morocco", "Wallace Line, Indonesia", "Fiordland, New Zealand",
    "Karoo Basin, South Africa", "Gobi Desert, Mongolia", "Białowieża Forest, Poland",
  ];

  const MINERAL_LOCALITIES = [
    "Broken Hill, Australia", "Erzgebirge, Saxony", "Ural Mountains, Russia",
    "Rio Grande do Sul, Brazil", "Potosí, Bolivia", "Tsumeb, Namibia",
    "Alpine clefts, Switzerland", "Franklin, New Jersey", "Madan, Bulgaria",
    "Dalnegorsk, Russia",
  ];

  const TAGS = [
    "type specimen", "taxidermy", "skeleton", "spirit collection", "3D scan",
    "genome voucher", "exhibit", "on display", "historically significant",
    "fragile", "recently added", "x-ray", "DNA barcoded", "wing preparation",
    "seed archive", "pinned specimen", "cast", "model",
  ];

  const ERAS = [
    { key: "era-foundation", label: "Foundation era", range: [1871, 1900] },
    { key: "era-edwardian", label: "Edwardian era", range: [1901, 1925] },
    { key: "era-interwar", label: "Interwar era", range: [1926, 1945] },
    { key: "era-postwar", label: "Postwar era", range: [1946, 1975] },
    { key: "era-modern", label: "Modern era", range: [1976, 2026] },
  ];

  function pickEra() {
    const r = rand() * 100;
    if (r < 8) return ERAS[0];
    if (r < 22) return ERAS[1];
    if (r < 40) return ERAS[2];
    if (r < 66) return ERAS[3];
    return ERAS[4];
  }

  function pickStatus() {
    const r = rand();
    if (r < 0.72) return "Digitized";
    if (r < 0.9) return "In review";
    return "On loan";
  }

  function pickTags() {
    const n = rint(2, 4);
    const out = [];
    while (out.length < n) {
      const t = pick(TAGS);
      if (out.indexOf(t) === -1) out.push(t);
    }
    return out;
  }

  /*
   * Section configs. `genera`, `commons`, `groups` are index-aligned so a
   * record's binomial, common name and curatorial group always agree.
   */
  const SECTIONS = [
    {
      key: "ornithology", label: "Ornithology", code: "ORN", count: 300,
      genera: ["Aquila", "Sterna", "Pica", "Cinclus", "Alcedo", "Buteo", "Sturnus", "Motacilla", "Certhia", "Upupa", "Merops", "Cuculus", "Apus", "Hirundo", "Lanius", "Regulus", "Phoenicurus", "Saxicola", "Emberiza", "Carduelis"],
      commons: ["Eagle", "Tern", "Magpie", "Dipper", "Kingfisher", "Hawk", "Starling", "Wagtail", "Treecreeper", "Hoopoe", "Bee-eater", "Cuckoo", "Swift", "Swallow", "Shrike", "Wren", "Redstart", "Wheatear", "Bunting", "Goldfinch"],
      epithets: ["chrysaetos", "albifrons", "macroura", "plumbea", "viridis", "fusca", "minor", "borealis", "orientalis", "occidentalis", "caledonica", "hispanica", "melanoleuca", "erythronotos", "leucoptera", "flaviventris", "nivalis", "arctica", "atrogularis", "gularis", "intermedia", "major", "obscura", "pallida"],
      adjectives: ["Slate-throated", "Ashy", "Rufous", "Pale-billed", "Great", "Lesser", "Spot-winged", "Blue-crowned", "Black-billed", "White-eyed", "Long-tailed", "Semi-collared", "Crested", "Dusky", "Buff-bellied"],
      groups: ["Raptors", "Seabirds", "Passerines", "Kingfishers & allies", "Swifts"],
      groupTaxa: { "Raptors": "Aves › Accipitriformes", "Seabirds": "Aves › Charadriiformes", "Passerines": "Aves › Passeriformes", "Kingfishers & allies": "Aves › Coraciiformes", "Swifts": "Aves › Apodiformes" },
      commonGroup: { "Eagle": "Raptors", "Hawk": "Raptors", "Tern": "Seabirds", "Kingfisher": "Kingfishers & allies", "Hoopoe": "Kingfishers & allies", "Bee-eater": "Kingfishers & allies", "Cuckoo": "Kingfishers & allies", "Swift": "Swifts", "Swallow": "Passerines", "Magpie": "Passerines", "Dipper": "Passerines", "Starling": "Passerines", "Wagtail": "Passerines", "Treecreeper": "Passerines", "Shrike": "Passerines", "Wren": "Passerines", "Redstart": "Passerines", "Wheatear": "Passerines", "Bunting": "Passerines", "Goldfinch": "Passerines" },
    },
    {
      key: "mammalogy", label: "Mammalogy", code: "MAM", count: 260,
      genera: ["Panthera", "Canis", "Vulpes", "Ursus", "Lutra", "Martes", "Cervus", "Capra", "Ovis", "Rattus", "Sciurus", "Erinaceus", "Sorex", "Myotis", "Rhinolophus", "Lepus", "Oryctolagus", "Marmota", "Castor", "Microtus"],
      commons: ["Lion", "Wolf", "Fox", "Bear", "Otter", "Marten", "Red Deer", "Ibex", "Argali", "Brown Rat", "Red Squirrel", "Hedgehog", "Shrew", "Mouse-eared Bat", "Horseshoe Bat", "Mountain Hare", "Rabbit", "Marmot", "Beaver", "Field Vole"],
      epithets: ["leo", "lupus", "vulpes", "arctos", "lutra", "foina", "elaphus", "ibex", "ammon", "norvegicus", "vulgaris", "europaeus", "araneus", "myotis", "hipposideros", "timidus", "cuniculus", "marmota", "fiber", "agrestis"],
      adjectives: ["Barbary", "Iberian", "Northern", "Alpine", "Steppe", "Caspian", "Himalayan", "Atlantic", "Pygmy", "Great", "Lesser", "Desert", "Coastal", "Highland", "Eastern"],
      groups: ["Carnivores", "Ungulates", "Rodents", "Bats", "Insectivores", "Lagomorphs"],
      groupTaxa: { "Carnivores": "Mammalia › Carnivora", "Ungulates": "Mammalia › Artiodactyla", "Rodents": "Mammalia › Rodentia", "Bats": "Mammalia › Chiroptera", "Insectivores": "Mammalia › Eulipotyphla", "Lagomorphs": "Mammalia › Lagomorpha" },
      commonGroup: { "Lion": "Carnivores", "Wolf": "Carnivores", "Fox": "Carnivores", "Bear": "Carnivores", "Otter": "Carnivores", "Marten": "Carnivores", "Red Deer": "Ungulates", "Ibex": "Ungulates", "Argali": "Ungulates", "Brown Rat": "Rodents", "Red Squirrel": "Rodents", "Marmot": "Rodents", "Beaver": "Rodents", "Field Vole": "Rodents", "Mouse-eared Bat": "Bats", "Horseshoe Bat": "Bats", "Hedgehog": "Insectivores", "Shrew": "Insectivores", "Mountain Hare": "Lagomorphs", "Rabbit": "Lagomorphs" },
    },
    {
      key: "herpetology", label: "Herpetology", code: "HRP", count: 210,
      genera: ["Naja", "Vipera", "Lacerta", "Gekko", "Testudo", "Emys", "Hyla", "Bufo", "Rana", "Salamandra", "Triturus", "Anguis", "Chamaeleo", "Python", "Crotalus", "Eublepharis"],
      commons: ["Cobra", "Viper", "Lizard", "Gecko", "Tortoise", "Pond Turtle", "Tree Frog", "Toad", "Frog", "Salamander", "Newt", "Slow Worm", "Chameleon", "Python", "Rattlesnake", "Leopard Gecko"],
      epithets: ["haje", "berus", "viridis", "gecko", "graeca", "orbicularis", "arborea", "vulgaris", "temporaria", "atra", "cristatus", "fragilis", "pardalis", "molurus", "horridus", "macularius"],
      adjectives: ["Egyptian", "Sand", "Green", "Tokay", "Spur-thighed", "European", "Common", "Giant", "Fire-bellied", "Alpine", "Marbled", "Slow", "Panther", "Burmese", "Western"],
      groups: ["Snakes", "Lizards", "Turtles", "Frogs", "Salamanders"],
      groupTaxa: { "Snakes": "Reptilia › Squamata › Serpentes", "Lizards": "Reptilia › Squamata › Lacertilia", "Turtles": "Reptilia › Testudines", "Frogs": "Amphibia › Anura", "Salamanders": "Amphibia › Caudata" },
      commonGroup: { "Cobra": "Snakes", "Viper": "Snakes", "Python": "Snakes", "Rattlesnake": "Snakes", "Lizard": "Lizards", "Gecko": "Lizards", "Leopard Gecko": "Lizards", "Slow Worm": "Lizards", "Chameleon": "Lizards", "Tortoise": "Turtles", "Pond Turtle": "Turtles", "Tree Frog": "Frogs", "Toad": "Frogs", "Frog": "Frogs", "Salamander": "Salamanders", "Newt": "Salamanders" },
    },
    {
      key: "ichthyology", label: "Ichthyology", code: "ICH", count: 240,
      genera: ["Salmo", "Thunnus", "Gadus", "Hippocampus", "Anguilla", "Clupea", "Scomber", "Cyprinus", "Esox", "Perca", "Carcharodon", "Rhincodon", "Latimeria", "Acipenser", "Sparus"],
      commons: ["Salmon", "Tuna", "Cod", "Seahorse", "Eel", "Herring", "Mackerel", "Carp", "Pike", "Perch", "White Shark", "Whale Shark", "Coelacanth", "Sturgeon", "Sea Bream"],
      epithets: ["salar", "thynnus", "morhua", "abdominalis", "anguilla", "harengus", "scombrus", "carpio", "lucius", "fluviatilis", "carcharias", "typus", "chalumnae", "ruthenus", "aurata"],
      adjectives: ["Atlantic", "Pacific", "Deepwater", "Giant", "Silver", "Spiny-finned", "Long-snouted", "Forkbeard", "Northern", "River", "Bluefin", "Broadfin", "Knysna", "Bastard", "Gilthead"],
      groups: ["Freshwater", "Pelagic", "Reef Fish", "Rays & Sharks", "Deep-sea"],
      groupTaxa: { "Freshwater": "Actinopterygii › Salmoniformes", "Pelagic": "Actinopterygii › Scombriformes", "Reef Fish": "Actinopterygii › Perciformes", "Rays & Sharks": "Chondrichthyes › Lamniformes", "Deep-sea": "Sarcopterygii › Coelacanthiformes" },
      commonGroup: { "Salmon": "Freshwater", "Cod": "Freshwater", "Sturgeon": "Freshwater", "Pike": "Freshwater", "Perch": "Freshwater", "Carp": "Freshwater", "Eel": "Freshwater", "Tuna": "Pelagic", "Herring": "Pelagic", "Mackerel": "Pelagic", "Seahorse": "Reef Fish", "Sea Bream": "Reef Fish", "White Shark": "Rays & Sharks", "Whale Shark": "Rays & Sharks", "Coelacanth": "Deep-sea" },
    },
    {
      key: "entomology", label: "Entomology", code: "ENT", count: 430,
      genera: ["Bombus", "Apis", "Papilio", "Carabus", "Cicindela", "Mantis", "Gryllus", "Formica", "Vespa", "Scarabaeus", "Lucanus", "Cerambyx", "Anopheles", "Musca", "Dynastes"],
      commons: ["Bumblebee", "Honeybee", "Swallowtail", "Ground Beetle", "Tiger Beetle", "Praying Mantis", "Field Cricket", "Wood Ant", "Hornet", "Dung Beetle", "Stag Beetle", "Longhorn Beetle", "Mosquito", "Housefly", "Hercules Beetle"],
      epithets: ["terrestris", "mellifera", "machaon", "auratus", "campestris", "religiosa", "sylvaticus", "rufa", "crabro", "sacer", "cervus", "cerdo", "atroparvus", "domestica", "hercules"],
      adjectives: ["Buff-tailed", "Western", "Old World", "Golden", "Green-striped", "Giant", "Woodland", "Southern", "Horned", "Sacred", "Mountain", "Long-horned", "Banded", "Lesser", "Rhinoceros"],
      groups: ["Beetles", "Butterflies & Moths", "Bees & Wasps", "Flies", "Orthoptera"],
      groupTaxa: { "Beetles": "Insecta › Coleoptera", "Butterflies & Moths": "Insecta › Lepidoptera", "Bees & Wasps": "Insecta › Hymenoptera", "Flies": "Insecta › Diptera", "Orthoptera": "Insecta › Orthoptera" },
      commonGroup: { "Bumblebee": "Bees & Wasps", "Honeybee": "Bees & Wasps", "Hornet": "Bees & Wasps", "Wood Ant": "Bees & Wasps", "Swallowtail": "Butterflies & Moths", "Ground Beetle": "Beetles", "Tiger Beetle": "Beetles", "Dung Beetle": "Beetles", "Stag Beetle": "Beetles", "Longhorn Beetle": "Beetles", "Hercules Beetle": "Beetles", "Praying Mantis": "Orthoptera", "Field Cricket": "Orthoptera", "Mosquito": "Flies", "Housefly": "Flies" },
    },
    {
      key: "botany", label: "Botany", code: "BOT", count: 390,
      genera: ["Quercus", "Fagus", "Pinus", "Betula", "Acer", "Rosa", "Silene", "Gentiana", "Orchis", "Drosera", "Pinguicula", "Saxifraga", "Primula", "Dryas", "Nepenthes"],
      commons: ["Oak", "Beech", "Pine", "Birch", "Maple", "Dog Rose", "Catchfly", "Gentian", "Orchid", "Sundew", "Butterwort", "Saxifrage", "Primrose", "Mountain Avens", "Pitcher Plant"],
      epithets: ["robur", "sylvatica", "sylvestris", "pendula", "platanoides", "canina", "vulgaris", "lutea", "mascula", "rotundifolia", "alpina", "oppositifolia", "veris", "octopetala", "rajah"],
      adjectives: ["English", "Copper", "Mountain", "Silver", "Norway", "Sweetbriar", "Mossy", "Stemless", "Early Purple", "Round-leaved", "Alpine", "Purple", "Bird's-eye", "White", "Giant"],
      groups: ["Trees & Shrubs", "Alpine Flora", "Orchids", "Carnivorous Plants"],
      groupTaxa: { "Trees & Shrubs": "Plantae › Fagales", "Alpine Flora": "Plantae › Caryophyllales", "Orchids": "Plantae › Asparagales", "Carnivorous Plants": "Plantae › Caryophyllales" },
      commonGroup: { "Oak": "Trees & Shrubs", "Beech": "Trees & Shrubs", "Pine": "Trees & Shrubs", "Birch": "Trees & Shrubs", "Maple": "Trees & Shrubs", "Dog Rose": "Trees & Shrubs", "Gentian": "Alpine Flora", "Catchfly": "Alpine Flora", "Saxifrage": "Alpine Flora", "Primrose": "Alpine Flora", "Mountain Avens": "Alpine Flora", "Cottongrass": "Alpine Flora", "Orchid": "Orchids", "Sundew": "Carnivorous Plants", "Butterwort": "Carnivorous Plants", "Pitcher Plant": "Carnivorous Plants" },
    },
    {
      key: "malacology", label: "Malacology", code: "MAL", count: 150,
      genera: ["Helix", "Conus", "Hexaplex", "Ostrea", "Mytilus", "Pecten", "Nautilus", "Octopus", "Sepia", "Loligo", "Achatina", "Littorina", "Patella", "Haliotis", "Spirula"],
      commons: ["Roman Snail", "Textile Cone", "Murex", "Oyster", "Mussel", "Scallop", "Nautilus", "Octopus", "Cuttlefish", "Squid", "Giant African Snail", "Periwinkle", "Limpet", "Abalone", "Ram's Horn"],
      epithets: ["pomatia", "textile", "trapa", "edulis", "galloprovincialis", "maximus", "pompilius", "vulgaris", "officinalis", "gahi", "fulica", "littorea", "vulgata", "tuberculata", "spirulae"],
      adjectives: ["Land", "Marbled", "Spiny", "Flat", "Blue", "Queen", "Chambered", "Common", "Pharaoh", "Veined", "Giant", "Rough", "Common limpet", "Pāua", "Deep-sea"],
      groups: ["Shells", "Cephalopods", "Bivalves", "Land Snails"],
      groupTaxa: { "Shells": "Mollusca › Gastropoda", "Cephalopods": "Mollusca › Cephalopoda", "Bivalves": "Mollusca › Bivalvia", "Land Snails": "Mollusca › Gastropoda › Pulmonata" },
      commonGroup: { "Nautilus": "Cephalopods", "Octopus": "Cephalopods", "Cuttlefish": "Cephalopods", "Squid": "Cephalopods", "Ram's Horn": "Cephalopods", "Oyster": "Bivalves", "Mussel": "Bivalves", "Scallop": "Bivalves", "Abalone": "Shells", "Textile Cone": "Shells", "Murex": "Shells", "Periwinkle": "Shells", "Limpet": "Shells", "Roman Snail": "Land Snails", "Giant African Snail": "Land Snails" },
    },
    {
      key: "paleontology", label: "Paleontology", code: "PAL", count: 160,
      genera: ["Archaeopteryx", "Amaltheus", "Belemnitella", "Calymene", "Paradoxides", "Megalosaurus", "Iguanodon", "Plesiosaurus", "Pterodactylus", "Diplodocus", "Stegosaurus", "Triceratops", "Mosasaurus", "Ichthyosaurus"],
      commons: ["First Bird", "Ammonite", "Belemnite", "Trilobite", "Trilobite", "Megalosaur", "Iguanodont", "Plesiosaur", "Pterosaur", "Sauropod", "Stegosaur", "Horned Dinosaur", "Mosasaur", "Ichthyosaur"],
      epithets: ["lithographica", "margaritatus", "muconata", "paradoxissimus", "giganteus", "bucklandii", "bernissartensis", "dolomdeusi", "elegans", "longus", "ungulatus", "prorsus", "hoffmannii", "platyurus"],
      adjectives: ["Complete", "Partial", "Juvenile", "Type-series", "Three-dimensional", "Pyritized", "Articulated", "Crushed", "Disarticulated", "Catalogue cast"],
      periods: ["Late Jurassic", "Early Jurassic", "Late Cretaceous", "Middle Cambrian", "Late Triassic", "Early Cretaceous"],
      commonGroup: { "First Bird": "Flying Reptiles", "Ammonite": "Ammonites", "Belemnite": "Ammonites", "Trilobite": "Trilobites", "Megalosaur": "Dinosaurs", "Iguanodont": "Dinosaurs", "Plesiosaur": "Marine Reptiles", "Pterosaur": "Flying Reptiles", "Sauropod": "Dinosaurs", "Stegosaur": "Dinosaurs", "Horned Dinosaur": "Dinosaurs", "Mosasaur": "Marine Reptiles", "Ichthyosaur": "Marine Reptiles" },
      groups: ["Dinosaurs", "Marine Reptiles", "Ammonites", "Trilobites", "Flying Reptiles"],
      groupTaxa: { "Dinosaurs": "Dinosauria › Saurischia / Ornithischia", "Marine Reptiles": "Sauropterygia / Mosasauridae", "Ammonites": "Cephalopoda › Ammonoidea", "Trilobites": "Trilobita", "Flying Reptiles": "Pterosauria" },
    },
    {
      key: "mineralogy", label: "Mineralogy", code: "MIN", count: 120,
      genera: ["Azurite", "Barite", "Beryl", "Calcite", "Crocoite", "Dolomite", "Epidote", "Fluorite", "Garnet", "Hematite", "Labradorite", "Pyrite", "Quartz", "Rhodonite", "Vanadinite"],
      commons: ["azurite", "barite", "beryl", "calcite", "crocoite", "dolomite", "epidote", "fluorite", "garnet", "hematite", "labradorite", "pyrite", "quartz", "rhodonite", "vanadinite"],
      epithets: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      adjectives: ["Botryoidal", "Gem-quality", "Massive", "Needle-fiber", "Radiating", "Water-clear", "Phantom", "Striated", "Twinned", "Iridescent", "Phosphorescent", "Banded", "Pseudomorphic", "Sceptred", "Tabular"],
      groups: ["Silicates", "Carbonates", "Sulfides & sulfates", "Phosphates & vanadates", "Oxides", "Halides"],
      groupTaxa: { "Silicates": "Minerals › Silicates", "Carbonates": "Minerals › Carbonates", "Sulfides & sulfates": "Minerals › Sulfides & sulfates", "Phosphates & vanadates": "Minerals › Phosphates & vanadates", "Oxides": "Minerals › Oxides", "Halides": "Minerals › Halides" },
      commonGroup: { "azurite": "Carbonates", "barite": "Sulfides & sulfates", "beryl": "Silicates", "calcite": "Carbonates", "crocoite": "Sulfides & sulfates", "dolomite": "Carbonates", "epidote": "Silicates", "fluorite": "Halides", "garnet": "Silicates", "hematite": "Oxides", "labradorite": "Silicates", "pyrite": "Sulfides & sulfates", "quartz": "Silicates", "rhodonite": "Silicates", "vanadinite": "Phosphates & vanadates" },
    },
  ];

  let seqNo = 1000;

  function makeItem(sec) {
    const era = pickEra();
    const year = rint(era.range[0], era.range[1]);
    const month = rint(1, 12);
    const k = rint(0, sec.genera.length - 1);
    const epithet = pick(sec.epithets);
    const genus = sec.genera[k];
    const name = epithet && sec.key !== "mineralogy" ? genus + " " + epithet : genus;
    const common = sec.key === "mineralogy"
      ? pick(sec.adjectives) + " " + sec.commons[k] + " variety"
      : pick(sec.adjectives) + " " + sec.commons[k];
    const group = sec.commonGroup
      ? (sec.commonGroup[sec.commons[k]] || pick(sec.groups))
      : sec.groups[k % sec.groups.length];
    const locality = sec.key === "mineralogy" ? pick(MINERAL_LOCALITIES) : pick(FIELD_LOCALITIES);
    const collector = pick(COLLECTORS);
    const status = pickStatus();
    const tags = pickTags();
    const id = sec.code + "-" + year + "-" + pad4(++seqNo);
    const displayDate = MONTHS[month - 1] + " " + year;
    const period = sec.key === "paleontology" ? pick(sec.periods) : null;
    const summary = (sec.key === "paleontology")
      ? (common + " (" + name + "), " + period + " — recovered " + displayDate + " at " + locality + " by " + collector + ". " + pick(CONDITIONS) + ".")
      : ((common + " (" + name + ") — " + group.toLowerCase() + " collected " + displayDate + " at " + locality + " by " + collector + ". " + pick(CONDITIONS) + "."));

    return {
      id: id,
      name: name,
      common: common,
      section: sec.key,
      sectionLabel: sec.label,
      group: group,
      taxa: sec.groupTaxa[group] || sec.label,
      status: status,
      era: era.key,
      eraLabel: era.label,
      year: year,
      date: displayDate,
      locality: locality,
      collector: collector,
      tags: tags,
      summary: summary,
    };
  }

  const items = [];
  SECTIONS.forEach(function (sec) {
    for (let i = 0; i < sec.count; i++) items.push(makeItem(sec));
  });

  /* Curated landmark records — replace a few generated rows so the index
   * contains verifiable, memorable targets for the locate path. */
  function curate(secKey, offset, spec) {
    let idx = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].section === secKey) {
        idx = i;
        break;
      }
    }
    const target = items[idx + offset];
    const base = target;
    const era = ERAS.filter(function (e) { return e.key === spec.era; })[0] || pickEra();
    const year = spec.year || rint(era.range[0], era.range[1]);
    const id = spec.id || (SECTIONS.filter(function (s) { return s.key === secKey; })[0].code + "-" + year + "-" + pad4(++seqNo));
    base.id = id;
    base.name = spec.name;
    base.common = spec.common;
    base.group = spec.group;
    base.taxa = spec.taxa;
    base.tags = spec.tags;
    base.status = spec.status;
    base.era = era.key;
    base.eraLabel = era.label;
    base.year = year;
    base.date = spec.date || (MONTHS[rint(0, 11)] + " " + year);
    base.locality = spec.locality;
    base.collector = spec.collector;
    base.summary = spec.summary;
    return base;
  }

  curate("ichthyology", 5, {
    id: "ICH-1938-0021", name: "Latimeria chalumnae", common: "Coelacanth",
    group: "Deep-sea", taxa: "Sarcopterygii › Coelacanthiformes",
    tags: ["type specimen", "spirit collection", "historically significant", "3D scan"],
    status: "Digitized", era: "era-interwar", year: 1938, date: "Dec 1938",
    locality: "Chalumna River mouth, South Africa", collector: "M. Courtenay-Latimer",
    summary: "Coelacanth (Latimeria chalumnae) — deep-sea specimen of the lineage once thought extinct since the Cretaceous, collected Dec 1938 at Chalumna River mouth, South Africa by M. Courtenay-Latimer. Condition at intake: fragile — handled with support.",
  });

  curate("ornithology", 2, {
    id: "ORN-1901-0007", name: "Aquila chrysaetos", common: "Golden Eagle",
    group: "Raptors", taxa: "Aves › Accipitriformes",
    tags: ["taxidermy", "exhibit", "on display", "historically significant"],
    status: "Digitized", era: "era-edwardian", year: 1901, date: "Apr 1901",
    locality: "Scottish Highlands", collector: "E. Hartmann",
    summary: "Golden Eagle (Aquila chrysaetos) — mount prepared for the 1902 raptors hall, collected Apr 1901 at Scottish Highlands by E. Hartmann. Condition at intake: stable, conserved 2019.",
  });

  curate("ornithology", 11, {
    id: "ORN-1889-0113", name: "Raphus cuculatus", common: "Dodo",
    group: "Pigeons & doves", taxa: "Aves › Columbiformes",
    tags: ["skeleton", "historically significant", "fragile"],
    status: "In review", era: "era-foundation", year: 1889, date: "Sep 1889",
    locality: "Mauritius (historical import)", collector: "Founding bequest",
    summary: "Dodo (Raphus cuculatus) — composite skeletal mount from the founding bequest, collected Sep 1889 at Mauritius (historical import). Condition at intake: fragile — handled with support.",
  });

  curate("mammalogy", 3, {
    id: "MAM-1897-0244", name: "Panthera leo leo", common: "Barbary Lion",
    group: "Carnivores", taxa: "Mammalia › Carnivora",
    tags: ["skull", "type specimen", "historically significant"],
    status: "Digitized", era: "era-foundation", year: 1897, date: "Feb 1897",
    locality: "Atlas Mountains, Morocco", collector: "Founding bequest",
    summary: "Barbary Lion (Panthera leo leo) — skull and skin of the North African lion population, collected Feb 1897 at Atlas Mountains, Morocco. Condition at intake: fair.",
  });

  curate("paleontology", 1, {
    id: "PAL-1877-0002", name: "Archaeopteryx lithographica", common: "First Bird (cast)",
    group: "Flying Reptiles", taxa: "Avialae › Archaeopterygidae",
    tags: ["cast", "3D scan", "type specimen", "exhibit"],
    status: "Digitized", era: "era-foundation", year: 1877, date: "Jul 1877",
    locality: "Solnhofen Limestone, Bavaria", collector: "Founding bequest",
    summary: "First Bird cast (Archaeopteryx lithographica) — Late Jurassic gallery-quality cast of the Berlin specimen, accessioned Jul 1877 from Solnhofen Limestone, Bavaria. Condition at intake: good.",
  });

  curate("mineralogy", 4, {
    id: "MIN-1958-0033", name: "Beryl (red beryl)", common: "Red beryl ('bixbite') variety",
    group: "Silicates", taxa: "Minerals › Silicates › Cyclosilicates",
    tags: ["gem-quality", "exhibit", "recently added"],
    status: "Digitized", era: "era-postwar", year: 1958, date: "May 1958",
    locality: "Wah Wah Mountains, Utah", collector: "L. Ashworth",
    summary: "Red beryl ('bixbite') variety (Beryl) — rare cyclosilicate from the violet claims, collected May 1958 at Wah Wah Mountains, Utah by L. Ashworth. Condition at intake: good, re-housed 2023.",
  });

  curate("botany", 6, {
    id: "BOT-1983-0177", name: "Nepenthes rajah", common: "Giant Pitcher Plant",
    group: "Carnivorous Plants", taxa: "Plantae › Caryophyllales › Nepenthaceae",
    tags: ["spirit collection", "exhibit", "DNA barcoded"],
    status: "Digitized", era: "era-modern", year: 1983, date: "Aug 1983",
    locality: "Mount Kinabalu, Borneo", collector: "T. Nakamura",
    summary: "Giant Pitcher Plant (Nepenthes rajah) — spirit-preserved intermediate pitcher, collected Aug 1983 at Mount Kinabalu, Borneo by T. Nakamura. Condition at intake: good.",
  });

  curate("entomology", 9, {
    id: "ENT-1965-0402", name: "Dynastes hercules", common: "Hercules Beetle",
    group: "Beetles", taxa: "Insecta › Coleoptera › Scarabaeidae",
    tags: ["pinned specimen", "3D scan", "on display"],
    status: "Digitized", era: "era-postwar", year: 1965, date: "Mar 1965",
    locality: "Guiana Shield, Guyana", collector: "S. Ferreira",
    summary: "Hercules Beetle (Dynastes hercules) — pinned male, 168 mm, collected Mar 1965 at Guiana Shield, Guyana by S. Ferreira. Condition at intake: good, re-housed 2023.",
  });

  curate("herpetology", 7, {
    id: "HRP-1971-0156", name: "Chamaeleo pardalis", common: "Panther Chameleon",
    group: "Lizards", taxa: "Reptilia › Squamata › Lacertilia",
    tags: ["spirit collection", "genome voucher", "recently added"],
    status: "In review", era: "era-modern", year: 1971, date: "Nov 1971",
    locality: "Madagascar (northwest)", collector: "C. Mensah",
    summary: "Panther Chameleon (Chamaeleo pardalis) — spirit collection male with color-note card, collected Nov 1971 at Madagascar (northwest) by C. Mensah. Condition at intake: fair.",
  });

  curate("malacology", 2, {
    id: "MAL-1929-0088", name: "Nautilus pompilius", common: "Chambered Nautilus",
    group: "Cephalopods", taxa: "Mollusca › Cephalopoda › Nautilidae",
    tags: ["exhibit", "on display", "historically significant"],
    status: "Digitized", era: "era-interwar", year: 1929, date: "Jun 1929",
    locality: "Wallace Line, Indonesia", collector: "P. Dubois",
    summary: "Chambered Nautilus (Nautilus pompilius) — display shell with sectioned companion showing chamber septa, collected Jun 1929 at Wallace Line, Indonesia by P. Dubois. Condition at intake: good.",
  });

  /* Precompute the search haystack once, at data materialization time. */
  items.forEach(function (it) {
    it.hay = [
      it.name, it.common, it.id, it.sectionLabel, it.group, it.locality,
      it.collector, it.tags.join(" "), it.summary, it.taxa, it.status, it.eraLabel,
    ].join(" ").toLowerCase();
  });

  window.COLLECTION = {
    name: "The Open Collection",
    subtitle: "Natural History Index",
    rebuilt: "2026-09-17",
    sections: SECTIONS.map(function (s) { return { key: s.key, label: s.label, code: s.code }; }),
    eras: ERAS,
    items: items,
    __sectionsConfig: SECTIONS,
  };
})();
