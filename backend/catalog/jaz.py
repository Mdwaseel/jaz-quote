"""JAZ Home Theatres reference content: the room → configuration guide, the quotation
template's scope, finishes and policies, and the handbook catalog used by `manage.py seed`.

Text comes from the JAZ quotation template (JAZ_Home_Theatres_Quotation_Template.xlsx)
and the JAZ brand documents; products, versions and prices from the JAZ Sales Hand Book.
The admin maintains prices in Admin → Prices & Catalog, and the sales team can set a
manual price on every line of every quotation.
"""

# Handbook series. Package.tier holds the series of a version.
SERIES = [
    ("CinePrime", "Value-engineered Dolby Atmos theatres — Full HD and 4K laser projection."),
    ("CineLuxe", "Premium DALI and Bowers & Wilkins systems with 4K laser projection."),
    ("CineRoyale", "Reference Perlisten and Bowers & Wilkins systems with dedicated power amplification."),
]
TIERS = [name for name, _ in SERIES]

PROJECT_TYPES = [
    "Dedicated Home Cinema",
    "Media Room",
    "Living Room Upgrade",
    "Music / Listening Room",
    "Mixed-use Entertainment Room",
]

CONSTRUCTION_STAGES = ["Planning / design", "Under construction", "Civil ready", "Existing room (retrofit)"]

# ------------------------------------------------------------------ room → configuration
# The JAZ configuration guide. "room" is the recommended room size for the configuration.
CONFIG_GUIDE = [
    {"Code": "5.1.2", "Name": "Compact / Living Room", "Room": "Up to ~200 sq.ft",
     "Meaning": "5 speakers + 1 subwoofer + 2 ceiling speakers"},
    {"Code": "7.1.2", "Name": "Standard Dedicated Theatre", "Room": "200–270 sq.ft",
     "Meaning": "7 speakers + 1 subwoofer + 2 ceiling speakers"},
    {"Code": "7.2.2", "Name": "Dual-Subwoofer Theatre", "Room": "as 7.1.2, with stronger and more even bass",
     "Meaning": "7 speakers + 2 subwoofers + 2 ceiling speakers"},
    {"Code": "7.2.4", "Name": "Premium Dedicated Theatre", "Room": "250–350 sq.ft",
     "Meaning": "7 speakers + 2 subwoofers + 4 ceiling speakers"},
    {"Code": "7.2.6", "Name": "Large Premium Theatre", "Room": "300–400 sq.ft",
     "Meaning": "7 speakers + 2 subwoofers + 6 ceiling speakers"},
    {"Code": "9.1.2", "Name": "Wide-Stage Theatre", "Room": "300–400 sq.ft",
     "Meaning": "9 speakers + 1 subwoofer + 2 ceiling speakers"},
    {"Code": "9.2.4", "Name": "Luxury Large Theatre", "Room": "350–450 sq.ft",
     "Meaning": "9 speakers + 2 subwoofers + 4 ceiling speakers"},
    {"Code": "9.2.6", "Name": "Flagship / Cinema Room", "Room": "400+ sq.ft",
     "Meaning": "9 speakers + 2 subwoofers + 6 ceiling speakers"},
]
CONFIGURATIONS = [c["Code"] for c in CONFIG_GUIDE]

# Reference rooms (feet). "Options" are the suitable configurations in the guide's order;
# "Pick" is the default recommendation, "Upgrade" the choice for two seating rows or a
# premium build. 9.1.2 is never recommended automatically.
ROOM_GUIDE = [
    {"Length": 12, "Width": 14, "Options": ["5.1.2"], "Pick": "5.1.2", "Upgrade": None, "Seats": "3–5", "Rating": "Ideal"},
    {"Length": 12, "Width": 16, "Options": ["5.1.2", "7.1.2"], "Pick": "5.1.2", "Upgrade": "7.1.2", "Seats": "4–6", "Rating": "Ideal"},
    {"Length": 14, "Width": 16, "Options": ["7.1.2"], "Pick": "7.1.2", "Upgrade": None, "Seats": "5–7", "Rating": "Ideal"},
    {"Length": 14, "Width": 18, "Options": ["7.1.2", "7.2.4"], "Pick": "7.1.2", "Upgrade": "7.2.4", "Seats": "5–8", "Rating": "Excellent"},
    {"Length": 14, "Width": 20, "Options": ["7.1.2", "7.2.4"], "Pick": "7.2.4", "Upgrade": None, "Seats": "6–8", "Rating": "Excellent",
     "Note": "7.2.4 is the sweet spot for this room."},
    {"Length": 15, "Width": 20, "Options": ["7.2.4"], "Pick": "7.2.4", "Upgrade": None, "Seats": "6–9", "Rating": "Ideal"},
    {"Length": 15, "Width": 23, "Options": ["7.2.4", "7.2.6"], "Pick": "7.2.4", "Upgrade": "7.2.6", "Seats": "7–10", "Rating": "Excellent"},
    {"Length": 15, "Width": 25, "Options": ["7.2.4", "7.2.6"], "Pick": "7.2.4", "Upgrade": "7.2.6", "Seats": "8–10", "Rating": "Excellent"},
    {"Length": 14, "Width": 30, "Options": ["9.2.4", "9.2.6"], "Pick": "9.2.6", "Upgrade": None, "Seats": "8–12", "Rating": "Ideal",
     "Note": "A 30 ft room is best served by 9.2.6 (premium)."},
    {"Length": 15, "Width": 29, "Options": ["9.2.4", "9.2.6"], "Pick": "9.2.4", "Upgrade": "9.2.6", "Seats": "8–12", "Rating": "Ideal"},
    {"Length": 16, "Width": 30, "Options": ["9.2.6"], "Pick": "9.2.6", "Upgrade": None, "Seats": "10–14", "Rating": "Premium"},
    {"Length": 18, "Width": 30, "Options": ["9.2.6"], "Pick": "9.2.6", "Upgrade": None, "Seats": "10–16", "Rating": "Premium"},
]
ROOM_TIPS = [
    "Don't choose by sq.ft alone — also check length and width, ceiling height, seating rows, screen size, "
    "number of seats and the AV receiver's channel capability.",
    "Two seating rows or a premium build → choose the larger option (e.g. 7.2.6 instead of 7.2.4).",
    "Don't make 9.1.2 the default upgrade.",
]

# Brand ecosystem (JAZ is brand-flexible — these are suggestions, never a limit).
BRANDS = {
    "Speakers & Subwoofers": [
        "Perlisten", "DALI", "Bowers & Wilkins", "Wharfedale", "Pylon Audio", "Taga Harmony", "Arendal",
        "Wisdom Audio", "PhaseTech", "Monitor Audio", "Paradigm", "Sonus faber", "ELAC", "Klipsch", "Genelec",
        "Q Acoustics", "Polk Audio", "Canton", "Revel", "Focal", "SVS",
    ],
    "Processing & Amplification": [
        "Denon", "Anthem", "Marantz", "Trinnov Audio", "Rotel", "ARCAM", "McIntosh", "Cambridge Audio", "Emotiva",
    ],
    "Projection & Video": ["BenQ", "Sony", "JVC", "Epson", "Barco", "Christie", "Elite Screens", "Panamorph"],
    "Infrastructure": ["Kordz", "Furman", "AudioQuest", "Lutron"],
}


def config_meaning(code):
    """'7.2.4' → '7 speakers + 2 subwoofers + 4 ceiling speakers' (guide text when known)."""
    code = (code or "").strip()
    for c in CONFIG_GUIDE:
        if c["Code"] == code:
            return c["Meaning"]
    parts = code.split(".")
    if len(parts) in (2, 3) and all(p.isdigit() for p in parts):
        ear, sub = int(parts[0]), int(parts[1])
        out = f"{ear} speakers + {sub} subwoofer{'' if sub == 1 else 's'}"
        if len(parts) == 3 and int(parts[2]):
            out += f" + {parts[2]} ceiling speakers"
        return out
    return ""


def config_name(code):
    return next((c["Name"] for c in CONFIG_GUIDE if c["Code"] == (code or "").strip()), "")


def spec_rows(pairs):
    return [{"Label": k, "Value": v} for k, v in pairs]

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

ACOUSTICS_NOTE_PDF = ("Acoustic treatment and cinema recliners are costed on the room's SFT and dimensions "
                      "(typically ₹4 lakh to ₹7 lakh) and are not included unless listed in the BOQ.")

NOTES = [
    "Final quotation is subject to site measurement, approved design, equipment availability and final model selection.",
    "Any change in specification, brand, quantity, room size or finish after approval may change the project price.",
    "Taxes are applicable as per prevailing government regulations.",
    "Product pricing may change due to manufacturer price revisions, exchange-rate movements or availability before procurement.",
    "Only written scope and approved BOQ will form part of the final order.",
    ACOUSTICS_NOTE_PDF,
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


# ------------------------------------------------------------------ handbook catalog
# From the JAZ Sales Hand Book (CinePrime / CineLuxe / CineRoyale). Prices are ex-GST
# unit prices (the handbook's line amount ÷ quantity); GST 18% is added on top.
CATEGORIES = [  # (name, order)
    ("Speakers & Subwoofers", 10),
    ("AV Receivers & Amplifiers", 20),
    ("Projector & Screen", 30),
    ("Cables & Accessories", 40),
    ("Installation & Calibration", 50),
    ("Acoustics & Seating", 60),
]

SPK, AVR, VID, ACC, INST, ROOM = (c for c, _ in CATEGORIES)
ACOUSTICS_NOTE = ("Acoustics and recliners are costed on the room's SFT and dimensions — typically ₹4 lakh to ₹7 lakh "
                  "— and quoted after the site survey.")

# key: (category, name, brand, unit, unit price, specification)
PRODUCTS = {
    # speakers & subwoofers
    "taga-tav507": (SPK, "TAV 507 5.0 Speaker Package", "Taga Harmony", "Set", 92900, "Front L/R, centre and surround speakers"),
    "taga-tcw290": (SPK, "TCW-290 R Ceiling Speakers", "Taga Harmony", "Pair", 18900, "Dolby Atmos height channels"),
    "taga-tsw210": (SPK, "TSW-210 Active Subwoofer", "Taga Harmony", "Pair", 53900, "Powered subwoofers"),
    "wh-d123": (SPK, "Diamond 12.3 Floor Standing Tower Speakers", "Wharfedale", "Pair", 119000, "Front left / right"),
    "wh-d12c": (SPK, "Diamond 12.C Centre Speaker", "Wharfedale", "Nos", 49000, "Centre channel"),
    "wh-dfs": (SPK, "WH-DFS On-Wall Surround Speakers", "Wharfedale", "Pair", 41000, "Surround channels"),
    "wh-wcm80": (SPK, "WCM-80 Ceiling Speakers (Atmos)", "Wharfedale", "Pair", 39000, "Dolby Atmos height channels"),
    "wh-sw12": (SPK, "SW-12 Subwoofer", "Wharfedale", "Nos", 94000, "Powered subwoofer"),
    "pylon-opal30": (SPK, "Opal 30 Floor Standing Speakers", "Pylon Audio", "Pair", 160000, "Front left / right"),
    "pylon-opalc": (SPK, "Opal Centre Speaker", "Pylon Audio", "Nos", 64000, "Centre channel"),
    "dali-sonik5": (SPK, "Sonik 5 Floor Standing Tower Speakers", "DALI", "Pair", 150000, "Front left / right"),
    "dali-sonik7": (SPK, "Sonik 7 Floor Standing Tower Speakers", "DALI", "Pair", 225000, "Front left / right"),
    "dali-sonik9": (SPK, "Sonik 9 Floor Standing Tower Speakers", "DALI", "Pair", 361000, "Front left / right"),
    "dali-sonikc": (SPK, "Sonik Cinema Centre Speaker", "DALI", "Nos", 75000, "Centre channel"),
    "dali-sonikow": (SPK, "Sonik On-Wall Surround Speakers", "DALI", "Pair", 99000, "Surround channels"),
    "dali-m375": (SPK, "Phantom M-375 In-Wall LCR Speakers", "DALI", "Nos", 132000, "Front left / centre / right, in-wall"),
    "dali-h80": (SPK, "Phantom H-80 In-Wall Surround Speakers", "DALI", "Pair", 125000, "Surround channels, in-wall"),
    "dali-e50": (SPK, "Phantom E-50 Ceiling Speakers (Atmos)", "DALI", "Pair", 56000, "Dolby Atmos height channels"),
    "dali-e12f": (SPK, "SUB E-12F Subwoofer", "DALI", "Nos", 123000, "Powered subwoofer"),
    "bw-603s3": (SPK, "603 S3 Floor Standing Tower Speakers", "Bowers & Wilkins", "Pair", 388000, "Front left / right"),
    "bw-htm6": (SPK, "HTM6 S3 Centre Speaker", "Bowers & Wilkins", "Nos", 136000, "Centre channel"),
    "bw-cwm362": (SPK, "CWM362 In-Wall Surround Speakers", "Bowers & Wilkins", "Nos", 32500, "Surround channels, in-wall"),
    "bw-ccm362": (SPK, "CCM362 Ceiling Speakers (Atmos)", "Bowers & Wilkins", "Nos", 28000, "Dolby Atmos height channel"),
    "bw-asw610": (SPK, "ASW610 Subwoofer", "Bowers & Wilkins", "Nos", 154000, "Powered subwoofer"),
    "bw-ct73": (SPK, "CT7.3 LCRS Speakers", "Bowers & Wilkins", "Nos", 280000, "Front left / centre / right"),
    "bw-cwm652": (SPK, "CWM652 In-Wall Surround Speakers", "Bowers & Wilkins", "Nos", 46000, "Surround channels, in-wall"),
    "bw-ccm664": (SPK, "CCM664 Ceiling Speakers (Atmos)", "Bowers & Wilkins", "Nos", 46000, "Dolby Atmos height channel"),
    "pl-x5w": (SPK, "X5w LCR In/On-Wall Speakers", "Perlisten", "Nos", 190000, "Front left / centre / right"),
    "pl-x2w": (SPK, "X2w Surround Speakers", "Perlisten", "Nos", 120000, "Surround channels"),
    "pl-x2ic": (SPK, "X2ic Ceiling Speakers", "Perlisten", "Nos", 105000, "Dolby Atmos height channel"),
    "pl-a3t": (SPK, "A3t Floor Standing Speakers", "Perlisten", "Pair", 565000, "Front left / right"),
    "pl-a3m": (SPK, "A3m Centre Speaker", "Perlisten", "Nos", 167500, "Centre channel"),
    "pl-r12s": (SPK, "R12s Subwoofer", "Perlisten", "Nos", 370000, "Powered subwoofer"),
    # AV receivers & amplifiers
    "denon-x1800h": (AVR, "AVR-X1800H 7 Channel AV Receiver", "Denon", "Nos", 119900, "Dolby Atmos / DTS:X AV receiver"),
    "denon-x3900h": (AVR, "AVC-X3900H 9 Channel AV Receiver", "Denon", "Nos", 269900, "Dolby Atmos / DTS:X AV receiver"),
    "denon-x4800h": (AVR, "AVC-X4800H 9 Channel AV Receiver", "Denon", "Nos", 329900, "Dolby Atmos / DTS:X AV receiver"),
    "denon-cinema50": (AVR, "Cinema 50 AV Receiver", "Denon", "Nos", 329900, "Dolby Atmos / DTS:X AV receiver"),
    "anthem-mca325": (AVR, "MCA 325 v2 3 Channel Power Amplifier", "Anthem", "Nos", 336900, "Dedicated LCR power amplification"),
    # projector & screen
    "benq-th575i": (VID, "TH575i Full HD Projector", "BenQ", "Nos", 89990, "Full HD projector"),
    "benq-tk710": (VID, "TK710 4K Laser Projector", "BenQ", "Nos", 349000, "4K laser projector"),
    "benq-w5850": (VID, "W5850 4K Laser Projector", "BenQ", "Nos", 650000, "4K laser projector"),
    "sony-xw5100": (VID, "VPL-XW5100ES 4K Laser Projector", "Sony", "Nos", 650000, "Native 4K laser projector"),
    "elite-sb120": (VID, "SB120WH2 120 Inch Diagonal Fixed Frame Screen", "Elite Screens", "Nos", 49450, "120\" fixed-frame screen"),
    "elite-er150": (VID, "ER150WH1 150 Inch Diagonal Fixed Frame Screen", "Elite Screens", "Nos", 90000, "150\" fixed-frame screen"),
    "elite-er150at": (VID, "ER150WH1 A1080P4K 150 Inch Diagonal Fixed Frame Acoustic Woven Screen", "Elite Screens", "Nos", 97200,
                      "150\" acoustically transparent screen"),
    # cables & accessories
    "kordz-16awg": (ACC, "16AWG 2C OFC Speaker Cable", "Kordz", "Mtr", 192.5, "Speaker cabling"),
    "kordz-hdmi-125": (ACC, "PRO3 HDMI Cable 12.5 Mts", "Kordz", "Nos", 18900, "Projector HDMI run"),
    "kordz-hdmi-15": (ACC, "PRO3 Optical HDMI Cable 15 Mts", "Kordz", "Nos", 36000, "Projector HDMI run"),
    "kordz-hdmi-2": (ACC, "PRO3 HDMI Cable 2 Mts", "Kordz", "Nos", 3200, "Source HDMI"),
    "kordz-sub": (ACC, "PRO-1AV Subwoofer Cable", "Kordz", "Nos", 2450, "Subwoofer cabling"),
    "mount": (ACC, "Ceiling Mount Kit for Projector", "Custom", "Nos", 6500, ""),
    "furman-m10x": (ACC, "M-10x E Power Conditioner", "Furman", "Nos", 27700, "Power conditioning and surge protection"),
    # services
    "install": (INST, "Installation, Transport & Sound Calibration", "JAZ", "Lot", 25000,
                "Installation, transport, termination and sound calibration"),
    "acoustics": (ROOM, "Acoustic Treatment & Cinema Recliners", "", "Lot", 0, ACOUSTICS_NOTE),
}

_ACC_FHD = [("kordz-16awg", 100), ("kordz-hdmi-125", 1), ("kordz-hdmi-2", 1), ("kordz-sub", 2), ("mount", 1), ("furman-m10x", 1)]
_ACC_4K = [("kordz-16awg", 150), ("kordz-hdmi-15", 1), ("kordz-hdmi-2", 1), ("kordz-sub", 2), ("mount", 1), ("furman-m10x", 1)]

# Each handbook block is a version: items are (product key, qty[, package price]); the
# package price is only set where the handbook prices an item differently in that block.
VERSIONS = [
    {"series": "CinePrime", "configuration": "5.1.2", "label": "Taga Harmony · Full HD", "install": 25000,
     "description": "Full HD Dolby Atmos · Taga Harmony TAV 507 speakers · Denon AVR-X1800H · BenQ TH575i · 120\" Elite screen",
     "items": [("taga-tav507", 1), ("taga-tcw290", 1), ("taga-tsw210", 1), ("denon-x1800h", 1), ("benq-th575i", 1),
               ("elite-sb120", 1)] + _ACC_FHD},
    {"series": "CinePrime", "configuration": "7.1.2", "label": "Wharfedale Diamond", "install": 25000,
     "description": "4K Dolby Atmos · Wharfedale Diamond 12 speakers · Denon AVC-X3900H · BenQ TK710 4K laser · 150\" Elite screen",
     "items": [("wh-d123", 1), ("wh-d12c", 1), ("wh-dfs", 2), ("wh-wcm80", 1), ("wh-sw12", 1), ("denon-x3900h", 1),
               ("benq-tk710", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CinePrime", "configuration": "7.1.2", "label": "Pylon Opal", "install": 30000,
     "description": "4K Dolby Atmos · Pylon Opal 30 towers · DALI Phantom height & SUB E-12F · Denon AVC-X3900H · BenQ TK710 4K laser",
     "items": [("pylon-opal30", 1), ("pylon-opalc", 1), ("wh-dfs", 2), ("dali-e50", 1), ("dali-e12f", 1), ("denon-x3900h", 1),
               ("benq-tk710", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CinePrime", "configuration": "7.1.2", "label": "DALI Sonik 5", "install": 40000,
     "description": "4K Dolby Atmos · DALI Sonik 5 towers + Sonik surrounds · Denon AVC-X3900H · BenQ TK710 4K laser",
     "items": [("dali-sonik5", 1), ("dali-sonikc", 1), ("dali-sonikow", 2), ("dali-e50", 1), ("dali-e12f", 1),
               ("denon-x3900h", 1), ("benq-tk710", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineLuxe", "configuration": "7.1.2", "label": "DALI Sonik 7", "install": 30000,
     "description": "4K Dolby Atmos · DALI Sonik 7 towers + Sonik surrounds · Denon AVC-X3900H · BenQ TK710 4K laser",
     "items": [("dali-sonik7", 1), ("dali-sonikc", 1), ("dali-sonikow", 2), ("dali-e50", 1), ("dali-e12f", 1),
               ("denon-x3900h", 1), ("benq-tk710", 1, 249000), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineLuxe", "configuration": "7.1.2", "label": "DALI Phantom In-Wall", "install": 40000,
     "description": "4K Dolby Atmos · invisible DALI Phantom in-wall LCR & surrounds · twin SUB E-12F · acoustic woven 150\" screen",
     "items": [("dali-m375", 3), ("dali-h80", 2), ("dali-e50", 1), ("dali-e12f", 2), ("denon-x3900h", 1), ("benq-tk710", 1),
               ("elite-er150at", 1)] + _ACC_4K},
    {"series": "CineLuxe", "configuration": "7.2.2", "label": "DALI Sonik 9 + Sony 4K", "install": 40000,
     "description": "4K Dolby Atmos · DALI Sonik 9 towers · twin SUB E-12F · Denon AVC-X3900H · Sony VPL-XW5100ES native 4K laser",
     "items": [("dali-sonik9", 1), ("dali-sonikc", 1), ("dali-sonikow", 2), ("dali-e50", 1), ("dali-e12f", 2),
               ("denon-x3900h", 1), ("sony-xw5100", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineLuxe", "configuration": "7.2.2", "label": "Bowers & Wilkins 603 S3", "install": 40000,
     "description": "4K Dolby Atmos · Bowers & Wilkins 603 S3 + HTM6 S3 · twin ASW610 · Denon AVC-X3900H · BenQ W5850 4K laser",
     "items": [("bw-603s3", 1), ("bw-htm6", 1), ("bw-cwm362", 4), ("bw-ccm362", 2), ("bw-asw610", 2), ("denon-x3900h", 1),
               ("benq-w5850", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineRoyale", "configuration": "7.1.2", "label": "Perlisten X-Series", "install": 40000,
     "description": "4K Dolby Atmos · Perlisten X5w LCR, X2w surrounds, R12s · Denon Cinema 50 + Anthem MCA 325 · BenQ W5850",
     "items": [("pl-x5w", 3), ("pl-x2w", 4), ("pl-x2ic", 2), ("pl-r12s", 1), ("denon-cinema50", 1), ("anthem-mca325", 1),
               ("benq-w5850", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineRoyale", "configuration": "7.1.2", "label": "Perlisten A3t", "install": 40000,
     "description": "4K Dolby Atmos · Perlisten A3t towers + A3m centre · Denon AVC-X4800H + Anthem MCA 325 · BenQ W5850",
     "items": [("pl-a3t", 1), ("pl-a3m", 1), ("pl-x2w", 4), ("pl-x2ic", 2), ("pl-r12s", 1), ("denon-x4800h", 1),
               ("anthem-mca325", 1), ("benq-w5850", 1), ("elite-er150", 1)] + _ACC_4K},
    {"series": "CineRoyale", "configuration": "7.2.2", "label": "Bowers & Wilkins CT7.3", "install": 50000,
     "description": "4K Dolby Atmos · Bowers & Wilkins CT7.3 LCR · twin Perlisten R12s · Anthem MCA 325 · acoustic woven 150\" screen",
     "items": [("bw-ct73", 3), ("bw-cwm652", 4), ("bw-ccm664", 2), ("pl-r12s", 2), ("denon-x3900h", 1, 329900),
               ("anthem-mca325", 1), ("benq-w5850", 1), ("elite-er150at", 1)] + _ACC_4K},
]


def version_name(v):
    return f"{v['series']} {v['configuration']} · {v['label']}"


def seed_catalog(ProductCategory, Product, Package, PackageItem):
    """Build the handbook catalog. Idempotent per name — never overwrites prices an
    admin has changed and never re-creates a version an admin deleted."""
    cats = {}
    for name, order in CATEGORIES:
        cats[name], _ = ProductCategory.objects.get_or_create(name=name, defaults={"order": order, "gst_percent": 18})
    products = {}
    for i, (key, (cat, name, brand, unit, price, spec)) in enumerate(PRODUCTS.items()):
        products[key], _ = Product.objects.get_or_create(
            category=cats[cat], name=name,
            defaults={"specification": spec, "brands": brand, "unit": unit, "price": price, "order": i},
        )
    series_order = {s: n for n, s in enumerate(TIERS)}
    for i, v in enumerate(sorted(VERSIONS, key=lambda v: (series_order[v["series"]], v["configuration"]))):
        package, created = Package.objects.get_or_create(
            name=version_name(v),
            defaults={"configuration": v["configuration"], "tier": v["series"], "description": v["description"],
                      "order": i},
        )
        if not created:
            continue
        rows = list(v["items"]) + [("install", 1, v["install"])]
        for j, row in enumerate(rows):
            key, qty = row[0], row[1]
            price = row[2] if len(row) > 2 else None
            if price is not None and price == PRODUCTS[key][4]:
                price = None  # same as the product's list price — follow it
            PackageItem.objects.create(package=package, product=products[key], qty=qty, price=price, order=j)
