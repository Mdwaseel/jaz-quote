"""JAZ Home Theatres reference content: the quotation template's specification,
scope, finishes and policies, plus the starting catalog used by `manage.py seed`.

Text comes from the JAZ quotation template (JAZ_Home_Theatres_Quotation_Template.xlsx)
and the JAZ brand documents. Prices in CATALOG are indicative starting points only —
the admin sets real list prices in Admin → Prices & Catalog, and the sales team can
set a manual price on every line of every quotation.
"""

TIERS = ["Sound System Solutions", "Complete Home Cinema", "Premium & Luxury Cinema"]

PROJECT_TYPES = [
    "Dedicated Home Cinema",
    "Media Room",
    "Living Room Upgrade",
    "Music / Listening Room",
    "Mixed-use Entertainment Room",
]

CONSTRUCTION_STAGES = ["Planning / design", "Under construction", "Civil ready", "Existing room (retrofit)"]

CONFIGURATIONS = ["5.1", "5.1.2", "5.1.4", "7.1.2", "7.2.4", "7.2.6", "9.2.4", "9.4.6", "11.4.6", "Custom"]

# Brand ecosystem (JAZ is brand-flexible — these are suggestions, never a limit).
BRANDS = {
    "Speakers & Subwoofers": [
        "PERLISTEN", "Arendal", "DALI", "Pylon Audio", "Bowers & Wilkins", "Wisdom Audio", "PhaseTech",
        "Monitor Audio", "Paradigm", "Sonus faber", "ELAC", "Klipsch", "Genelec", "Q Acoustics", "Episode",
        "BIC America", "Polk Audio", "Canton", "Revel", "Focal", "SVS",
    ],
    "Processing & Amplification": [
        "Trinnov Audio", "Rotel", "Anthem", "ARCAM", "Marantz", "Denon", "Acurus", "Audio Research",
        "McIntosh", "Cambridge Audio", "Linn", "Emotiva",
    ],
    "Projection & Video": ["Barco", "JVC", "Sony", "Christie", "Epson", "BenQ", "LG", "Panamorph"],
    "Infrastructure": ["Kordz", "AudioQuest", "Lutron"],
}

# ------------------------------------------------------------------ specification
SPEC_LABELS = [
    "Theatre Format", "Display", "Screen", "Front Stage", "Surround", "Height / Atmos", "Subwoofers",
    "AV Processor / AVR", "Amplification", "Acoustics", "Seating", "Lighting", "Automation",
    "Connectivity", "Calibration",
]

SPEC_724 = [
    ("Theatre Format", "7.2.4 Dolby Atmos immersive home cinema"),
    ("Display", "4K laser projector + acoustically transparent cinema screen"),
    ("Screen", "Recommended 120–150 inch class; final size based on room dimensions and viewing distance"),
    ("Front Stage", "LCR cinema speakers behind acoustically transparent screen"),
    ("Surround", "4 side/rear surround speakers"),
    ("Height / Atmos", "4 in-ceiling / on-ceiling height channels"),
    ("Subwoofers", "2 powered subwoofers, room-calibrated"),
    ("AV Processor / AVR", "11-channel-capable Dolby Atmos / DTS:X processing with room correction"),
    ("Amplification", "Dedicated power amplification as required by final speaker sensitivity and room size"),
    ("Acoustics", "Broadband absorption, bass trapping, diffusion and first-reflection treatment"),
    ("Seating", "Motorised electric cinema recliners; quantity as per final layout"),
    ("Lighting", "Dimmable layered theatre lighting with scene control"),
    ("Automation", "Cinema control for projector, AV, lighting, screen and selected smart devices"),
    ("Connectivity", "4K/8K-rated HDMI distribution, network connectivity and concealed cabling"),
    ("Calibration", "Audio level/delay/EQ calibration and projector image calibration"),
]

SPEC_512 = [
    ("Theatre Format", "5.1.2 Dolby Atmos immersive sound system"),
    ("Display", "Existing / customer-supplied TV or projector (integration included)"),
    ("Screen", "As per existing display; screen upgrade available on request"),
    ("Front Stage", "Tonally matched LCR speakers (bookshelf / on-wall / in-wall as per interior)"),
    ("Surround", "2 side surround speakers"),
    ("Height / Atmos", "2 in-ceiling height channels"),
    ("Subwoofers", "1 powered subwoofer, room-calibrated"),
    ("AV Processor / AVR", "9-channel Dolby Atmos / DTS:X AVR with room correction"),
    ("Amplification", "Integrated AVR amplification"),
    ("Acoustics", "First-reflection and rear-wall treatment as required"),
    ("Seating", "Existing seating (cinema seating available on request)"),
    ("Lighting", "Existing lighting (scene control available on request)"),
    ("Automation", "Single remote / app control of the AV system"),
    ("Connectivity", "4K-rated HDMI and concealed speaker cabling"),
    ("Calibration", "Audio level, distance and EQ calibration"),
]

SPEC_946 = [
    ("Theatre Format", "9.4.6 Dolby Atmos reference private cinema"),
    ("Display", "Reference 4K laser projector with dedicated video processing"),
    ("Screen", "2.40:1 CinemaScope acoustically transparent screen with motorised masking"),
    ("Front Stage", "Reference LCR speakers behind the screen, timbre-matched"),
    ("Surround", "6 side/rear surround speakers"),
    ("Height / Atmos", "6 in-ceiling height channels"),
    ("Subwoofers", "4 subwoofers, placement-optimised for multi-seat bass consistency"),
    ("AV Processor / AVR", "16-channel reference AV processor with advanced room optimisation"),
    ("Amplification", "Dedicated multichannel power amplification with headroom for reference levels"),
    ("Acoustics", "Engineered isolation, broadband absorption, bass control and diffusion"),
    ("Seating", "Luxury motorised recliners on an engineered riser; quantity as per final layout"),
    ("Lighting", "Architectural layered lighting, star ceiling and scene control"),
    ("Automation", "Full cinema automation — projector, masking, AV, lighting, climate scenes"),
    ("Connectivity", "8K-rated HDMI distribution, network infrastructure and concealed cabling"),
    ("Calibration", "Professional audio (multi-seat) and video (Calman) calibration with final verification"),
]


def spec_rows(pairs):
    return [{"Label": k, "Value": v} for k, v in pairs]


DEFAULT_SPEC = spec_rows(SPEC_724)

# ------------------------------------------------------------------ scope & finishes
SCOPE = [
    "Room measurement and site technical survey",
    "Cinema room layout and speaker / projector placement planning",
    "Acoustic treatment design and installation",
    "False ceiling / feature wall coordination as per approved design",
    "Cinema carpet / flooring treatment",
    "Premium theatre recliner seating",
    "4K laser projection system and screen",
    "Immersive Dolby Atmos audio system",
    "AV processor / AVR and power amplification",
    "Subwoofer integration and bass management",
    "Lighting and cinema scene automation",
    "Concealed AV cabling, termination and labelling",
    "System installation, testing and final calibration",
]

FINISHES = [
    ("Wall Treatment", "Fabric acoustic panels / decorative acoustic treatment"),
    ("Ceiling", "Acoustic false ceiling with integrated lighting"),
    ("Flooring", "Cinema carpet / acoustic underlay as approved"),
    ("Screen Wall", "Acoustically transparent screen wall with concealed LCR"),
    ("Lighting", "Dimmable downlights / LED strips / step lighting"),
    ("Seating", "Premium electric recliner upholstery — colour selected by customer"),
    ("Cable Management", "Concealed conduits and labelled AV termination"),
]

DEFAULT_FINISHES = spec_rows(FINISHES)

STANDARD_FEATURES = [
    "Dolby Atmos / DTS:X immersive audio support (subject to selected processor)",
    "4K HDR video support (subject to selected projector/source chain)",
    "Room correction and speaker calibration",
    "Independent subwoofer integration and bass management",
    "Projector image alignment and focus setup",
    "AV rack / equipment management",
    "Concealed speaker and signal cabling",
    "Power conditioning / surge protection as specified",
    "Remote / scene-based cinema operation",
    "System testing and customer demonstration",
]

# ------------------------------------------------------------------ commercial terms
STANDARD_PAYMENT_TERMS = [
    ("Advance against booking / design initiation", 30),
    ("Before installation / dispatch of major AV equipment", 60),
    ("Against completion, testing and handover", 10),
]

PROCUREMENT_NOTE = (
    "Equipment procurement / reservation may commence after receipt of the applicable advance and signed "
    "order confirmation. Cancellation terms are governed by the Order Confirmation, Procurement & "
    "Cancellation Policy."
)

TIMELINES = [
    "4–6 weeks after site readiness",
    "6–8 weeks after site readiness",
    "8–10 weeks after site readiness",
    "10–12 weeks after site readiness",
    "12–16 weeks after site readiness",
]

VALIDITY_DAYS = [7, 15, 30, 45]

# ------------------------------------------------------------------ policies (PDF)
PROJECT_DELIVERY = [
    "Design and equipment finalisation: after site survey and customer approval.",
    "Installation schedule: dependent on civil readiness, approved drawings and equipment availability.",
    "Final equipment models and finishes will be confirmed in the approved BOQ / final quotation.",
    "Project completion and handover are subject to site readiness and timely customer approvals.",
]

DELIVERY_STAGES = [
    ("Design", "Room survey, layout, acoustic and AV design after booking."),
    ("Procurement", "Equipment procurement begins after final model and payment approval."),
    ("Installation", "Installation starts after site readiness and delivery of major equipment."),
    ("Commissioning", "Testing, calibration and customer demonstration before handover."),
]

CUSTOMER_SCOPE = [
    "Dedicated electrical supply, earthing, MCB/RCCB and required power points as per final electrical drawing.",
    "Room must be handed over in suitable civil condition before installation.",
    "Civil changes, major carpentry, structural changes, HVAC relocation and external networking are excluded unless specifically quoted.",
    "Air-conditioning / ventilation must be suitable for enclosed theatre occupancy and equipment heat load.",
    "Customer to provide safe storage and access to site during installation.",
    "Approve drawings, finishes, equipment and changes without undue delay.",
]

JAZ_SCOPE = [
    "Technical site survey and room assessment",
    "Cinema design and AV system design",
    "Supply and installation of quoted equipment",
    "Acoustic treatment and theatre finishing as per approved scope",
    "AV rack / equipment integration",
    "Cable termination, testing and labelling",
    "System calibration and commissioning",
    "Customer demonstration and handover",
]

EXCLUSIONS = [
    "Major civil/structural modifications, room extension, waterproofing and structural reinforcement.",
    "Air-conditioning equipment, fresh-air system and major electrical panel upgrades.",
    "Internet service, OTT subscriptions, content subscriptions and third-party smart-home works.",
    "Any product or finish not listed in the approved BOQ.",
]

NOTES = [
    "Final quotation is subject to site measurement, approved design, equipment availability and final model selection.",
    "Any change in specification, brand, quantity, room size or finish after approval may change the project price.",
    "Taxes are applicable as per prevailing government regulations.",
    "Product pricing may change due to manufacturer price revisions, exchange-rate movements or availability before procurement.",
    "Only written scope and approved BOQ will form part of the final order.",
]

ORDER_POLICY = [
    ("Order Confirmation",
     "The quotation shall become a confirmed order only upon receipt of the required advance payment and signed "
     "customer acceptance of the quotation / BOQ."),
    ("Equipment Procurement",
     "Upon order confirmation, JAZ Home Theatres may reserve or procure speakers, subwoofers, amplifiers, projector, "
     "screen, AV electronics, seating and other project-specific materials based on the approved specification."),
    ("No Cancellation After Confirmation",
     "Once the quotation / BOQ is signed and the order is confirmed, the order shall be treated as non-cancellable "
     "because JAZ may commit funds towards equipment reservation, procurement, customisation and project scheduling."),
    ("Cancellation / Withdrawal",
     "If the customer requests cancellation, withdrawal or postponement after order confirmation, any advance or "
     "amount already paid may be adjusted against committed procurement costs, supplier cancellation charges, "
     "custom-order costs, design costs and other non-recoverable project expenses, subject to applicable law and "
     "the final written agreement."),
    ("Custom / Special-Order Products",
     "Products specifically ordered, imported, customised, allocated or reserved for the project are non-returnable "
     "and non-cancellable once procurement has commenced, subject to the applicable manufacturer / supplier terms."),
    ("Price Protection",
     "Equipment pricing is based on the approved quotation at the time of order. Subsequent manufacturer price "
     "revisions, currency fluctuations, freight changes or taxes may result in a corresponding price revision for "
     "items not yet procured."),
    ("Design Changes",
     "Changes requested after approval of the design or BOQ may result in additional design, restocking, "
     "cancellation, freight, installation or price-difference charges."),
    ("Project Postponement",
     "Customer-requested postponement after procurement or scheduling may require storage, re-booking, "
     "transportation or other reasonable project charges."),
    ("Final Scope",
     "The signed quotation, approved BOQ and approved drawings together constitute the agreed project scope. "
     "Any variation must be approved in writing."),
]

ACKNOWLEDGEMENT = (
    "I/We understand that JAZ Home Theatres may commit funds and reserve/procure project-specific equipment after "
    "order confirmation. I/We have reviewed and accepted the quotation, BOQ, specifications, payment terms and "
    "cancellation/procurement policy above."
)

ABOUT = [
    "JAZ Home Theatres specialises in end-to-end residential home cinema solutions. We transform an empty room into "
    "a purpose-designed entertainment environment through acoustic planning, architectural interiors, cinema "
    "seating, projection, immersive audio, automation and final system calibration.",
    "Our turnkey approach coordinates design, acoustics, AV integration, lighting, control and installation so the "
    "customer receives one professionally integrated home theatre rather than a collection of individual products.",
]

PRINCIPLES = [
    ("Room-First Engineering", "Your cinema is designed around the actual room — dimensions, construction, seating and "
                               "acoustic behaviour — before equipment is recommended."),
    ("Brand-Flexible System Design", "We are not limited to one manufacturer. Speakers, processing, amplification and "
                                     "projection are combined for the performance the project needs."),
    ("Professional Calibration", "The completed cinema is measured, corrected and verified in the actual room — "
                                 "audio and picture are never left at factory settings."),
    ("Experience-Based Selection", "Reference cinema, music, invisible speakers or powerful bass — the equipment "
                                   "follows the experience you want."),
]


# ------------------------------------------------------------------ starting catalog
# category: (order, products) — product: (key, name, specification, brands, unit, price)
CATALOG = {
    "Video": (10, [
        ("proj-value", "4K Laser Projector — Premium Value", "4K laser projector, HDR capable", "BenQ / Epson — final selection", "Nos", 285000),
        ("proj-hp", "4K Laser Projector — High Performance", "Native 4K laser projector, HDR, lens memory", "Sony / JVC — final selection", "Nos", 650000),
        ("proj-ref", "Reference 4K Laser Projector", "Reference-class native 4K laser projector with dedicated video processing", "JVC / Sony / Barco — final selection", "Nos", 1200000),
        ("anamorphic", "Anamorphic Lens (CinemaScope)", "Professional anamorphic lens for 2.40:1 constant-image-height presentation", "Panamorph / equivalent", "Nos", 450000),
    ]),
    "Screen": (20, [
        ("screen-at", "Acoustically Transparent Cinema Screen", "Acoustically transparent fixed-frame cinema screen", "120–150 inch class", "Nos", 95000),
        ("screen-scope", "CinemaScope 2.40:1 AT Screen with Motorised Masking", "2.40:1 acoustically transparent screen with motorised masking", "Final size after throw/viewing analysis", "Nos", 350000),
    ]),
    "Front LCR": (30, [
        ("lcr-bookshelf", "LCR Speakers — Bookshelf / On-wall", "Tonally matched L/C/R speakers", "DALI / Q Acoustics / Polk class", "Nos", 30000),
        ("lcr-cinema", "LCR Cinema Speakers (behind screen)", "Identical L/C/R cinema speakers behind screen", "Perlisten / Focal / Klipsch / Monitor Audio class", "Nos", 55000),
        ("lcr-ref", "Reference LCR Speakers (THX-capable)", "Reference L/C/R speakers behind screen, timbre-matched", "PERLISTEN S/R-Series / equivalent", "Nos", 220000),
    ]),
    "Surround": (40, [
        ("sur-std", "Surround Speakers", "Side + rear surround speakers", "Matching cinema series", "Nos", 28000),
        ("sur-ref", "Reference Surround Speakers", "Side + rear reference surround speakers", "Matching reference series", "Nos", 75000),
    ]),
    "Height / Atmos": (50, [
        ("atmos-std", "In-ceiling Atmos Speakers", "Height / ceiling speakers", "Matching in-ceiling cinema series", "Nos", 24000),
        ("atmos-ref", "Reference In-ceiling Atmos Speakers", "Reference height channels", "Matching reference series", "Nos", 60000),
    ]),
    "Subwoofer": (60, [
        ("sub-std", "Powered Subwoofer", "Powered subwoofer", "Perlisten / SVS / Focal / equivalent", "Nos", 75000),
        ("sub-ref", "Reference Subwoofer", "High-output reference subwoofer", "PERLISTEN D-Series / equivalent", "Nos", 210000),
    ]),
    "Processor / AVR": (70, [
        ("avr-9", "9-channel Dolby Atmos AVR", "Dolby Atmos / DTS:X AVR with room correction", "Denon / Marantz — final selection", "Nos", 135000),
        ("avr-11", "11-channel Dolby Atmos Processor / AVR", "Dolby Atmos / DTS:X processor with room correction", "Denon / Marantz / Anthem / equivalent", "Nos", 210000),
        ("proc-ref", "Reference 16-channel AV Processor", "Reference AV processor with advanced room optimisation", "Trinnov Audio / Anthem / equivalent", "Nos", 900000),
    ]),
    "Power Amplification": (80, [
        ("amp-std", "Multichannel Power Amplifier", "Dedicated multichannel amplification", "Marantz / Emotiva / Anthem / equivalent", "Nos", 95000),
        ("amp-ref", "Reference Multichannel Power Amplifier", "High-headroom multichannel amplification", "Anthem / Rotel / McIntosh / equivalent", "Nos", 350000),
    ]),
    "Acoustics": (90, [
        ("ac-first", "First-reflection Acoustic Treatment", "Absorption panels at first-reflection points and rear wall", "Custom room treatment", "Lot", 55000),
        ("ac-full", "Acoustic Treatment — Absorption, Bass Trapping & Diffusion", "Broadband absorption + bass trapping + diffusion", "Custom room treatment", "Lot", 140000),
        ("ac-engineered", "Engineered Acoustics with Sound Isolation", "Isolation structure, broadband absorption, bass control and diffusion", "Engineering based", "Lot", 900000),
    ]),
    "Cinema Seating": (100, [
        ("seat-recliner", "Motorised Electric Recliner", "Motorised electric recliner", "Premium electric recliner", "Nos", 38000),
        ("seat-luxury", "Luxury Motorised Cinema Recliner", "Luxury motorised recliner with powered headrest", "Luxury cinema seating", "Nos", 110000),
        ("riser", "Engineered Seating Riser", "Riser calculated for sightlines, with integrated cabling and step lighting", "Custom construction", "Lot", 250000),
    ]),
    "Interiors": (105, [
        ("int-ceiling", "Acoustic False Ceiling with Integrated Lighting", "Acoustic false ceiling as per approved design", "As per approved design", "Lot", 120000),
        ("int-carpet", "Cinema Carpet with Acoustic Underlay", "Cinema carpet / acoustic underlay as approved", "As approved", "Sq.ft", 180),
        ("int-star", "Fibre-optic Star Ceiling", "Fibre-optic star ceiling panel", "As per approved design", "Lot", 150000),
    ]),
    "Lighting": (110, [
        ("light-std", "Dimmable Cinema Lighting + Scene Control", "Dimmable cinema lighting + scene control", "Lutron / smart control class", "Lot", 48000),
        ("light-arch", "Architectural Layered Lighting System", "Layered architectural lighting with scene control", "Lutron / equivalent", "Lot", 300000),
    ]),
    "Automation": (120, [
        ("auto-std", "Cinema Control System", "Cinema control system", "Smart control / IR / IP automation", "Lot", 55000),
        ("auto-full", "Full Cinema Automation", "Projector, masking, AV, lighting and climate scene automation", "IP automation platform", "Lot", 250000),
    ]),
    "Cabling & Infrastructure": (130, [
        ("cab-std", "AV Cabling & Termination", "HDMI, speaker, network, power and control cabling", "Certified AV cabling (Kordz / AudioQuest class)", "Lot", 42000),
        ("cab-ref", "Reference AV Infrastructure", "8K-rated HDMI distribution, network and concealed cabling", "Kordz / AudioQuest", "Lot", 150000),
        ("power", "Power Conditioning / Surge Protection", "Power conditioning and surge protection for AV equipment", "As specified", "Nos", 35000),
    ]),
    "AV Rack": (140, [
        ("rack", "Ventilated AV Rack", "AV rack / equipment cabinet", "Ventilated rack", "Nos", 24000),
    ]),
    "Calibration & Commissioning": (150, [
        ("cal-audio", "Audio Calibration", "Audio level, distance, EQ and subwoofer calibration", "JAZ professional commissioning", "Lot", 30000),
        ("cal-std", "Audio + Projector Calibration & Commissioning", "Audio + projector commissioning/calibration", "JAZ professional commissioning", "Lot", 45000),
        ("cal-ref", "Professional Audio + Video Calibration (multi-seat)", "Multi-seat audio optimisation and Calman video calibration", "JAZ professional commissioning", "Lot", 150000),
    ]),
    "Design & Installation": (160, [
        ("design", "Cinema Design & Engineering", "Site survey, room layout, acoustic and AV system design", "JAZ design team", "Lot", 60000),
        ("install", "Installation & Integration", "Supply logistics, installation, termination and system integration", "JAZ installation team", "Lot", 40000),
        ("design-ref", "Reference Cinema Design & Project Management", "Full design, drawings, coordination and project management", "JAZ design team", "Lot", 250000),
    ]),
}

PACKAGES = [
    {
        "name": "5.1.2 Atmos Sound System", "configuration": "5.1.2", "tier": "Sound System Solutions",
        "description": "Immersive Dolby Atmos sound for a living room or media room, built around the existing display.",
        "spec": SPEC_512,
        "items": [("avr-9", 1), ("lcr-bookshelf", 3), ("sur-std", 2), ("atmos-std", 2), ("sub-std", 1),
                  ("ac-first", 1), ("cab-std", 1), ("cal-audio", 1), ("install", 1)],
    },
    {
        "name": "7.2.4 Dolby Atmos Home Cinema", "configuration": "7.2.4", "tier": "Complete Home Cinema",
        "description": "Turnkey dedicated home cinema — projection, acoustically transparent screen, immersive audio, "
                       "acoustics, seating, lighting and calibration.",
        "spec": SPEC_724,
        "items": [("proj-value", 1), ("screen-at", 1), ("lcr-cinema", 3), ("sur-std", 4), ("atmos-std", 4),
                  ("sub-std", 2), ("avr-11", 1), ("amp-std", 1), ("ac-full", 1), ("seat-recliner", 6),
                  ("light-std", 1), ("auto-std", 1), ("cab-std", 1), ("rack", 1), ("cal-std", 1),
                  ("design", 1), ("install", 1)],
    },
    {
        "name": "9.4.6 Reference Private Cinema", "configuration": "9.4.6", "tier": "Premium & Luxury Cinema",
        "description": "Reference-level private cinema with CinemaScope presentation, engineered acoustics, "
                       "multi-subwoofer bass and luxury interiors.",
        "spec": SPEC_946,
        "items": [("proj-ref", 1), ("screen-scope", 1), ("lcr-ref", 3), ("sur-ref", 6), ("atmos-ref", 6),
                  ("sub-ref", 4), ("proc-ref", 1), ("amp-ref", 2), ("ac-engineered", 1), ("seat-luxury", 10),
                  ("riser", 1), ("int-star", 1), ("light-arch", 1), ("auto-full", 1), ("cab-ref", 1),
                  ("power", 1), ("rack", 1), ("cal-ref", 1), ("design-ref", 1), ("install", 1)],
    },
]


def seed_catalog(ProductCategory, Product, Package, PackageItem):
    """Build the starting catalog. Idempotent per name — never overwrites prices an
    admin has changed and never re-creates something an admin deleted unless the
    catalog is empty."""
    products = {}
    for cat_name, (order, rows) in CATALOG.items():
        cat, _ = ProductCategory.objects.get_or_create(name=cat_name, defaults={"order": order})
        for i, (key, name, spec, brands, unit, price) in enumerate(rows):
            p, _ = Product.objects.get_or_create(
                category=cat, name=name,
                defaults={"specification": spec, "brands": brands, "unit": unit, "price": price, "order": i},
            )
            products[key] = p
    for i, pkg in enumerate(PACKAGES):
        package, created = Package.objects.get_or_create(
            name=pkg["name"],
            defaults={"configuration": pkg["configuration"], "tier": pkg["tier"], "description": pkg["description"],
                      "spec": spec_rows(pkg["spec"]), "order": i},
        )
        if created:
            for j, (key, qty) in enumerate(pkg["items"]):
                PackageItem.objects.create(package=package, product=products[key], qty=qty, order=j)
