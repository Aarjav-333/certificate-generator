import { blankConfig } from '../lib/config'
import type { CertificateConfig } from '../types/certificate'
import { newId } from '../utils/dataUrl'
import { sampleLogo, sampleSignature } from './sampleAssets'

const SAMPLE_SIGNATORIES = [
  { name: 'Prof. A. Sample', designation: 'Coordinator', sign: 'A. Sample' },
  { name: 'Prof. B. Sample', designation: 'Coordinator', sign: 'B Sample' },
  { name: 'Dr. C. Sample', designation: 'Head of Department', sign: 'C. Sample' },
  { name: 'Dr. D. Sample', designation: 'Principal', sign: 'D Sample' },
]

/** Realistic placeholder content so the certificate is visible on first load. */
export async function sampleConfig(templateId = 'reference'): Promise<CertificateConfig> {
  const base = blankConfig(templateId)
  const [logo, ...signatures] = await Promise.all([
    sampleLogo(),
    ...SAMPLE_SIGNATORIES.map((s, i) => sampleSignature(s.sign, i)),
  ])
  return {
    ...base,
    institution: {
      ...base.institution,
      name: 'College of Engineering Trivandrum',
      subtitle: 'Thiruvananthapuram – 695016',
      department: '',
      logo,
    },
    participant: {
      salutation: 'Shri.',
      name: 'Aarjav Oravakandi',
      designation: 'Student Coordinator',
      department: 'Department of Computer Science and Engineering',
      institution: 'College of Engineering Trivandrum',
    },
    event: {
      name: 'Sample Technical Event',
      type: 'three-day technical workshop',
      organizer: 'Sample Organization',
      venue: 'Thiruvananthapuram',
      startDate: '2026-09-20',
      endDate: '2026-09-22',
      description: '',
    },
    issueDate: '2026-09-22',
    signatories: SAMPLE_SIGNATORIES.map((s, i) => ({
      id: newId(),
      name: s.name,
      designation: s.designation,
      organization: '',
      signature: signatures[i],
      showSignature: true,
      signatureScale: 0.82,
      signatureOffsetX: 0,
      signatureOffsetY: 0,
    })),
  }
}
