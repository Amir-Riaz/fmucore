// ============================================================
// FMUCORE — Abstract Submission reference data
// Pure data, no logic. Imported by abstract-form.js
// ============================================================

export const INSTITUTES = [
  "Aga Khan University Medical College, Karachi", "Allama Iqbal Medical College, Lahore",
  "Akhtar Saeed Medical & Dental College, Lahore", "Al-Nafees Medical College & Hospital, Islamabad",
  "Amna Inayat Medical College, Sheikhupura", "Army Medical College (AMC), Rawalpindi",
  "Avicenna Medical College, Lahore", "Ayub Medical College, Abbottabad",
  "Azad Jammu & Kashmir Medical College, Muzaffarabad", "Azra Naheed Medical College, Lahore",
  "Bahria University Medical & Dental College, Karachi", "Bakhtawar Amin Medical College, Multan",
  "Bannu Medical College, Bannu", "Baqai Medical University, Karachi", "Bolan Medical College, Quetta",
  "Central Park Medical College, Lahore", "Chandka Medical College, Larkana",
  "CMH Bahawalpur Institute of Medical Sciences", "CMH Kharian Medical College",
  "CMH Lahore Medical College & Institute of Dentistry", "CMH Multan Institute of Medical Sciences",
  "CMH Peshawar Medical College", "CMH Quetta Institute of Medical Sciences",
  "Continental Medical College, Lahore", "D.G. Khan Medical College, Dera Ghazi Khan",
  "Dr. Ziauddin University, Karachi", "Dow University of Health Sciences, Karachi",
  "Fatima Memorial College of Medicine & Dentistry, Lahore", "Fazaia Medical College, Islamabad",
  "Fatima Jinnah Medical University, Lahore", "Faisalabad Medical University, Faisalabad",
  "Foundation University Medical College (FUMC), Islamabad", "Frontier Medical College, Abbottabad",
  "Gilgit Medical College, Gilgit", "Gomal Medical College, D.I. Khan", "Gujranwala Medical College, Gujranwala",
  "Hamdard College of Medicine & Dentistry, Karachi", "HITEC Institute of Medical Sciences, Taxila",
  "Hussain Memorial Medical College, Lahore", "Ibn-e-Sina Medical College, Multan",
  "Independent Medical College, Faisalabad", "Islam Medical College, Sialkot",
  "Islamic International Medical College (IIMC), Rawalpindi", "Isra University, Hyderabad",
  "Jinnah Sindh Medical University, Karachi", "King Edward Medical University, Lahore",
  "Khawaja Muhammad Safdar Medical College, Sialkot", "Khyber Medical College, Peshawar",
  "Karachi Medical & Dental College, Karachi", "Khyber Medical University, Peshawar",
  "Lahore Medical & Dental College, Lahore", "Liaquat National Hospital & Medical College, Karachi",
  "Loralai Medical College, Loralai", "Liaquat University of Medical & Health Sciences, Jamshoro",
  "Makran Medical College, Turbat", "Margalla Institute of Health Sciences, Rawalpindi",
  "Mohi-ud-Din Islamic Medical College, Mirpur", "Muhammad Islam Medical College, Gujranwala",
  "Muhammad Medical College, Mirpur Khas", "Multan Medical & Dental College, Multan",
  "Nawaz Sharif Medical College, Gujranwala", "Nishtar Medical University, Multan",
  "Northwest School of Medicine, Peshawar", "Nowshera Medical College, Nowshera",
  "Pak International Medical College, Peshawar", "Pak Red Crescent Medical College, Lahore",
  "Peoples University of Medical & Health Sciences, Nawabshah", "Peshawar Medical College, Peshawar",
  "Pakistan Navy Medical College, Karachi", "Poonch Medical College, Rawalakot",
  "Quaid-e-Azam Medical College, Bahawalpur", "Rahbar Medical & Dental College, Lahore",
  "Rashid Latif Medical College, Lahore", "Rehman Medical College, Peshawar",
  "Riphah International University – College of Medicine, Islamabad", "Rawalpindi Medical University, Rawalpindi",
  "Sahiwal Medical College, Sahiwal", "Saidu Medical College, Swat", "Sargodha Medical College, Sargodha",
  "Shalamar Medical & Dental College, Lahore", "Sharif Medical & Dental College, Lahore",
  "Sheikh Zayed Medical College, Rahim Yar Khan", "Shifa College of Medicine, Islamabad",
  "Sialkot Medical College, Sialkot", "Services Institute of Medical Sciences, Lahore",
  "Sir Syed College of Medical Sciences, Karachi", "Swat Medical College, Swat",
  "United Medical & Dental College, Karachi", "University Medical & Dental College, Faisalabad",
  "Wah Medical College, Wah Cantt", "Women Medical College, Abbottabad", "Others"
];

export const FIELDS_OF_STUDY = ["MBBS", "BDS", "Allied Health Sciences", "Others"];

export const YEARS_OF_STUDY = [
  "First Year", "Second Year", "Third Year", "Fourth Year", "Final Year",
  "House Officer / Intern", "Demonstrator", "Post Graduate or Above"
];

export const PROVINCES = [
  "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan",
  "Islamabad Capital Territory", "Azad Jammu and Kashmir", "Gilgit-Baltistan"
];

export const CITIES_BY_PROVINCE = {
  "Punjab": ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Jhang", "Rahim Yar Khan", "Kasur", "Okara", "Sahiwal", "Gujrat", "Wazirabad", "Mandi Bahauddin", "Hafizabad", "Narowal", "Khanewal", "Vehari", "Lodhran", "Pakpattan", "Chiniot", "Toba Tek Singh", "Nankana Sahib", "Attock", "Chakwal", "Jhelum", "Mianwali", "Bhakkar", "Layyah", "Muzaffargarh", "Khushab", "Others"],
  "Sindh": ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Jacobabad", "Shikarpur", "Dadu", "Khairpur", "Sanghar", "Badin", "Thatta", "Tando Adam", "Tando Allahyar", "Kashmore", "Qambar", "Matiari", "Umerkot", "Ghotki", "Others"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Swat", "Dera Ismail Khan", "Kohat", "Bannu", "Charsadda", "Nowshera", "Swabi", "Mansehra", "Haripur", "Tank", "Lakki Marwat", "Chitral", "Dir (Upper)", "Dir (Lower)", "Malakand", "Buner", "Shangla", "Hangu", "Karak", "Others"],
  "Balochistan": ["Quetta", "Gwadar", "Turbat", "Sibi", "Zhob", "Chaman", "Loralai", "Khuzdar", "Nushki", "Mastung", "Pishin", "Dera Bugti", "Panjgur", "Kech", "Lasbela", "Kalat", "Kharan", "Jaffarabad", "Others"],
  "Islamabad Capital Territory": ["Islamabad", "Others"],
  "Azad Jammu and Kashmir": ["Muzaffarabad", "Mirpur", "Kotli", "Bhimber", "Rawalakot", "Bagh", "Neelum", "Haveli", "Hattian Bala", "Poonch", "Sudhnoti", "Others"],
  "Gilgit-Baltistan": ["Gilgit", "Skardu", "Hunza", "Nagar", "Astore", "Ghanche", "Diamer", "Shigar", "Others"]
};

export const SPECIALTIES = [
  { specialty: "Allergy and Immunology", subspecialties: [] },
  { specialty: "Anesthesiology", subspecialties: ["Adult Cardiac Anesthesiology", "Critical Care Medicine", "Health Care Administration, Leadership, and Management", "Hospice and Palliative Medicine", "Neurocritical Care", "Pain Medicine", "Pediatric Anesthesiology", "Sleep Medicine"] },
  { specialty: "Colon & Rectal Surgery", subspecialties: [] },
  { specialty: "Dermatology", subspecialties: ["Dermatopathology", "Micrographic Dermatologic Surgery", "Pediatric Dermatology"] },
  { specialty: "Emergency Medicine", subspecialties: ["Anesthesiology Critical Care Medicine", "Emergency Medical Services", "Health Care Administration, Leadership, and Management", "Hospice and Palliative Medicine", "Internal Medicine - Critical Care Medicine", "Medical Toxicology", "Neurocritical Care", "Pain Medicine", "Pediatric Emergency Medicine", "Sports Medicine", "Undersea and Hyperbaric Medicine"] },
  { specialty: "Family Medicine", subspecialties: ["Adolescent Medicine", "Geriatric Medicine", "Health Care Administration, Leadership, and Management", "Hospice and Palliative Medicine", "Pain Medicine", "Sleep Medicine", "Sports Medicine"] },
  { specialty: "Internal Medicine", subspecialties: ["Adolescent Medicine", "Adult Congenital Heart Disease", "Advanced Heart Failure and Transplant Cardiology", "Cardiovascular Disease", "Clinical Cardiac Electrophysiology", "Critical Care Medicine", "Endocrinology, Diabetes and Metabolism", "Gastroenterology", "Geriatric Medicine", "Hematology", "Hospice and Palliative Medicine", "Infectious Disease", "Interventional Cardiology", "Medical Oncology", "Nephrology", "Neurocritical Care", "Pulmonary Disease", "Rheumatology", "Sleep Medicine", "Sports Medicine", "Transplant Hepatology"] },
  { specialty: "Medical Education", subspecialties: [] },
  { specialty: "Medical Genetics & Genomics", subspecialties: ["Clinical Biochemical Genetics", "Clinical Cytogenetics and Genomics", "Clinical Genetics and Genomics", "Clinical Molecular Genetics and Genomics"] },
  { specialty: "Neurological Surgery", subspecialties: [] },
  { specialty: "Nuclear Medicine", subspecialties: [] },
  { specialty: "Obstetrics & Gynecology", subspecialties: ["Complex Family Planning", "Female Pelvic Medicine and Reconstructive Surgery", "Gynecologic Oncology", "Maternal-Fetal Medicine", "Reproductive Endocrinology and Infertility"] },
  { specialty: "Ophthalmology", subspecialties: [] },
  { specialty: "Orthopaedic Surgery", subspecialties: ["Orthopaedic Sports Medicine", "Surgery of the Hand"] },
  { specialty: "Otolaryngology (Head & Neck Surgery)", subspecialties: ["Complex Pediatric Otolaryngology", "Neurotology", "Sleep Medicine"] },
  { specialty: "Pathology", subspecialties: ["Blood Banking/Transfusion Medicine", "Chemical Pathology", "Clinical Informatics", "Cytopathology", "Dermatopathology", "Forensic Pathology", "Hematopathology", "Medical Microbiology", "Molecular Genetic Pathology", "Neuropathology", "Pediatric Pathology"] },
  { specialty: "Pediatrics", subspecialties: ["Adolescent Medicine", "Child Abuse Pediatrics", "Developmental-Behavioral Pediatrics", "Neonatal-Perinatal Medicine", "Pediatric Cardiology", "Pediatric Critical Care Medicine", "Pediatric Emergency Medicine", "Pediatric Endocrinology", "Pediatric Gastroenterology", "Pediatric Hematology-Oncology", "Pediatric Infectious Diseases", "Pediatric Nephrology", "Pediatric Pulmonology", "Pediatric Rheumatology", "Pediatric Transplant Hepatology", "Sleep Medicine", "Sports Medicine"] },
  { specialty: "Physical Medicine & Rehabilitation", subspecialties: ["Brain Injury Medicine", "Hospice and Palliative Medicine", "Neuromuscular Medicine", "Pain Medicine", "Pediatric Rehabilitation Medicine", "Spinal Cord Injury Medicine", "Sports Medicine"] },
  { specialty: "Plastic Surgery", subspecialties: ["Hand Surgery", "Craniofacial Surgery"] },
  { specialty: "Preventive Medicine", subspecialties: ["Aerospace Medicine", "Occupational Medicine", "Public Health and General Preventive Medicine"] },
  { specialty: "Psychiatry & Neurology", subspecialties: ["Addiction Psychiatry", "Brain Injury Medicine", "Child and Adolescent Psychiatry", "Clinical Neurophysiology", "Epilepsy", "Forensic Psychiatry", "Geriatric Psychiatry", "Hospice and Palliative Medicine", "Neurocritical Care", "Neuromuscular Medicine", "Pain Medicine", "Sleep Medicine", "Vascular Neurology"] },
  { specialty: "Radiology", subspecialties: ["Diagnostic Radiology", "Interventional Radiology", "Neuroradiology", "Nuclear Radiology", "Pediatric Radiology"] },
  { specialty: "Surgery (General Surgery Board)", subspecialties: ["Complex General Surgical Oncology", "Pediatric Surgery", "Surgical Critical Care", "Vascular Surgery"] },
  { specialty: "Thoracic Surgery", subspecialties: ["Congenital Cardiac Surgery"] },
  { specialty: "Urology", subspecialties: ["Female Pelvic Medicine and Reconstructive Surgery", "Pediatric Urology"] },
  { specialty: "Others", subspecialties: [] }
];

export const ABSTRACT_TYPES = [
  "Original Research (Cross Sectional / Cohort)",
  "Systematic Review / Meta-Analysis",
  "Case Report / Case Series",
  "Other"
];

export const AUTHOR_RANKS = ["Second Author", "Third Author", "Fourth Author", "Fifth Author", "Sixth Author"];
export const AUTHOR_STATUSES = ["Co Presenter", "Co-Author"];
