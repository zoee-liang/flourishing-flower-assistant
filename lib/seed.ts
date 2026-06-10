import { Center, KBEntry } from "./types";

// Fictional center. Policies are grounded in / inspired by the public
// Albuquerque DCFD Family Handbook (illness, medication, hours, meals, naps),
// with invented specifics where the public doc is income-based or vague
// (tuition, holiday calendar, late fees, tours).
export const ASSISTANT_NAME = "Poppy";

export const CENTER: Center = {
  name: "Flourishing Flowers Daycare Center",
  director: "Ms. Elena Rivera",
  phone: "(505) 555-0142",
  email: "frontdesk@flourishingflowers.example",
  hoursLine: "Mon–Fri, 7:00 AM – 5:30 PM",
};

export const SEED_KB: KBEntry[] = [
  {
    id: "hours",
    category: "Schedule",
    title: "Hours of operation",
    body: "Flourishing Flowers is open Monday through Friday, 7:00 AM to 5:30 PM. Our Pre-K core day runs 8:00 AM–2:30 PM, with Extended Care available 2:30 PM–5:30 PM. We are closed on weekends.",
    source: "Parent Handbook → Hours of Operation",
  },
  {
    id: "holidays",
    category: "Schedule",
    title: "Holiday & closure calendar (2026)",
    body: "We are closed on: New Year's Day, MLK Jr. Day (Jan 19), Memorial Day (May 25), Independence Day (Jul 3 observed), Labor Day (Sep 7), Veterans Day (Nov 11), Thanksgiving (Nov 26–27), and Winter Break (Dec 24–Jan 1). We also close two staff professional-development days: Mar 13 and Oct 9.",
    source: "Parent Handbook → Closure Dates",
  },
  {
    id: "tuition",
    category: "Billing",
    title: "Tuition by age group",
    body: "Monthly tuition: Infants (6 wks–18 mo) $1,650; Toddlers (18–36 mo) $1,450; Preschool (3–4 yr) $1,250; Pre-K (4–5 yr) $1,150. A one-time registration fee of $150 applies. Sliding-scale assistance and state subsidies are available for qualifying families — ask the front office.",
    source: "Parent Handbook → Tuition & Fees",
  },
  {
    id: "illness",
    category: "Health",
    title: "Illness / when to keep your child home",
    body: "Per state licensing, please keep your child home if they: have a fever of 100.4°F or higher (or had one in the last 24 hours), have vomited or had diarrhea in the last 24 hours, have pink eye, have been on antibiotics less than 24 hours, have a contagious illness (chicken pox, ringworm), or have an undiagnosed rash. A child may return once they are fever-free for 24 hours without fever-reducing medication. If symptoms appear at school, a parent will be called for pickup.",
    source: "Parent Handbook → Illness Policy",
    sensitive: true,
  },
  {
    id: "medication",
    category: "Health",
    title: "Medication administration",
    body: "Staff can administer medication only with a completed written permission form listing the child's name, the medication, the dosage, and the times to give it. All medication must arrive in its original, labeled container and be handed to a teacher to store securely. Children's Tylenol may be given with a signed form. Cough drops are not administered (choking hazard).",
    source: "Parent Handbook → Medication",
    sensitive: true,
  },
  {
    id: "allergies",
    category: "Health",
    title: "Allergies",
    body: "Children with allergies must have a documented allergy and emergency action plan on file, signed by a parent and physician. Flourishing Flowers is a nut-aware center and staff are trained on allergy response and epinephrine administration where prescribed.",
    source: "Parent Handbook → Health & Safety",
    sensitive: true,
  },
  {
    id: "meals",
    category: "Meals",
    title: "Meals & snacks (and forgotten lunches)",
    body: "We serve breakfast, lunch, and an afternoon snack daily, family-style, following USDA nutrition guidelines. The weekly menu is posted in the lobby and in the app. If a child arrives without lunch, the center will always provide that day's menu meal at no extra charge — never worry about a forgotten lunch.",
    source: "Parent Handbook → Nutrition",
  },
  {
    id: "tours",
    category: "Enrollment",
    title: "Scheduling a tour",
    body: "Tours run Tuesday and Thursday at 9:30 AM and 4:00 PM. Request one through the front office, by phone, or via the 'Schedule a Tour' form on our website. Enrollment requires a completed application, signed contract, and up-to-date immunization records.",
    source: "Parent Handbook → Enrollment",
    action: { label: "Schedule a tour", href: "/example" },
  },
  {
    id: "arrival",
    category: "Daily",
    title: "Arrival, departure & authorized pickup",
    body: "Parents sign their child in and out each day in the app. Children are only released to adults on the authorized pickup list; new or unfamiliar pickups must show a photo ID. Please update your authorized list with the front office whenever it changes.",
    source: "Parent Handbook → Arrival and Departure",
  },
  {
    id: "latepickup",
    category: "Billing",
    title: "Late pickup",
    body: "Pickup is by 5:30 PM. A late fee of $1 per minute, per child, applies after 5:30 PM, billed to your account. Repeated late pickups are reviewed with the director.",
    source: "Parent Handbook → Late Pick-up",
  },
  {
    id: "weather",
    category: "Safety",
    title: "Weather & snow days",
    body: "Flourishing Flowers follows Albuquerque Public Schools for weather closures and delays. Closures and early dismissals are announced through the app, email, and text as early as possible.",
    source: "Parent Handbook → Snow Days",
  },
  {
    id: "immunizations",
    category: "Health",
    title: "Immunizations",
    body: "Up-to-date immunization records are required before a child's first day, per New Mexico state requirements. Medical and religious exemptions are accepted where allowed by state law with the proper documentation.",
    source: "Parent Handbook → Health & Safety",
    sensitive: true,
  },
  {
    id: "naps",
    category: "Daily",
    title: "Naps & rest time",
    body: "Children have a supervised rest period after lunch. Infants nap and eat on demand following each family's schedule. We provide cots; please send a small labeled blanket.",
    source: "Parent Handbook → Naps and Rest Time",
  },
  {
    id: "bring",
    category: "Daily",
    title: "What to bring / clothing",
    body: "Please send a labeled set of spare clothes, weather-appropriate layers, and any comfort item for nap. Children play outdoors daily, so dress them for the weather. Label everything with your child's name.",
    source: "Parent Handbook → Items Brought From Home",
  },
  {
    id: "contact",
    category: "Contact",
    title: "Contacting the center",
    body: "Reach the front desk at (505) 555-0142 or frontdesk@flourishingflowers.example during operating hours. For anything urgent or about your child's health or safety, ask for the director, Ms. Elena Rivera.",
    source: "Parent Handbook → Contact",
    action: { label: "Call the front desk", href: "tel:+15055550142" },
  },
  {
    id: "brightwheel",
    category: "Technology",
    title: "Brightwheel app help",
    body: "We use the Brightwheel app for daily check-in, photos and daily reports, messaging, and billing. For help with the app itself — signing in, notifications, or in-app payments — contact Brightwheel support at support@mybrightwheel.com or tap Help inside the app. For anything about your child or our center, please contact us directly.",
    source: "Parent Handbook → Technology",
    action: { label: "Open Brightwheel Help", href: "https://help.mybrightwheel.com" },
  },
  {
    id: "curriculum",
    category: "Programs",
    title: "Programs, curriculum & what your child learns",
    body: "Flourishing Flowers offers infant, toddler, preschool, and Pre-K programs. Our play-based curriculum nurtures early literacy, numbers, social-emotional skills, creativity, and motor development through daily circle time, art, music, story time, outdoor play, and hands-on exploration. Each classroom shares its weekly activity plan in the Brightwheel app. For a full overview or to see a classroom in action, we'd love for you to schedule a tour.",
    source: "Parent Handbook → Programs",
    action: { label: "Schedule a tour", href: "/example" },
  },
  {
    id: "help-topics",
    category: "General",
    title: "What you can ask Poppy",
    body: "I can help with hours and closures, tuition and fees, meals, what to bring, naps, illness and medication policies, our programs and curriculum, scheduling a tour, enrollment, the Brightwheel app, and how to reach the center. For anything about your specific child's health, safety, or care, I'll connect you with a staff member.",
    source: "Front Desk",
  },
];
