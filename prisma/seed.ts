import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.dentist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.clinic.deleteMany();

  await prisma.clinic.create({
    data: {
      name: 'Sheheryar Dental AI Clinic',
      about:
        'Sheheryar Ali Dental AI Clinic is a portfolio-ready dental practice demo that combines preventive care, restorative treatment, and AI-assisted patient support.',
      mission:
        'Showcase clear treatment planning, dependable appointment booking, and a modern AI-powered clinic experience under the Sheheryar Ali brand.',
      address: 'Office 12, Main Boulevard, Johar Town, Lahore, Pakistan',
      phone: '+92 300 1234567',
      whatsapp: '+92 300 1234567',
      email: 'sheheryarali@example.com',
      mapUrl:
        'https://www.google.com/maps?q=Office+12+Main+Boulevard+Johar+Town+Lahore+Pakistan&output=embed',
      hours: {
        mon: '09:00-18:00',
        tue: '09:00-18:00',
        wed: '09:00-18:00',
        thu: '09:00-18:00',
        fri: '09:00-16:00',
        sat: '10:00-14:00',
        sun: 'Closed'
      }
    }
  });

  await prisma.service.createMany({
    data: [
      {
        name: 'Professional Teeth Cleaning',
        description: 'Routine hygiene visit with examination, plaque removal, and polishing.',
        durationMin: 45,
        price: 120,
        calEventTypeId: 5891707
      },
      {
        name: 'Root Canal Therapy',
        description: 'Endodontic treatment to remove infection, protect the tooth, and relieve pain.',
        durationMin: 90,
        price: 780,
        calEventTypeId: 5891707
      },
      {
        name: 'Dental Implant Consultation',
        description: 'Comprehensive implant consultation with digital imaging review and treatment planning.',
        durationMin: 60,
        price: 180,
        calEventTypeId: 5891707
      }
    ]
  });

  await prisma.dentist.createMany({
    data: [
      {
        name: 'Dr. Ayesha Malik',
        specialty: 'General and family dentistry',
        bio: 'Focused on preventive care, patient education, and minimally invasive restorative treatment.',
        photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
        calUserId: 201
      },
      {
        name: 'Dr. Sheheryar Ali',
        specialty: 'Endodontics',
        bio: 'Specializes in root canal therapy and urgent pain management with microscope-assisted treatment.',
        photoUrl: 'https://images.unsplash.com/photo-1612531386530-97286d97c2d2?auto=format&fit=crop&w=800&q=80',
        calUserId: 202
      },
      {
        name: 'Dr. Sana Rehman',
        specialty: 'Implant and restorative dentistry',
        bio: 'Works on implant planning, full-mouth rehabilitation, and restorative case coordination.',
        photoUrl: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=800&q=80',
        calUserId: 203
      }
    ]
  });

}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
