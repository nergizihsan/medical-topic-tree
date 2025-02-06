export const MEDICAL_TOPICS = [
  "Cardiovascular",
  "Dermatology / ENT / Eyes",
  "Endocrinology / Metabolic",
  "Gastroenterology / Nutrition",
  "Infectious disease / Haematology / Immunology / Allergies / Genetics",
  "Musculoskeletal",
  "Paediatrics",
  "Pharmacology & Therapeutics",
  "Psychiatry / Neurology",
  "Renal / Urology",
  "Reproductive",
  "Respiratory"
] as const

export type MedicalTopic = typeof MEDICAL_TOPICS[number] 