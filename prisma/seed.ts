import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.dentist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.clinic.deleteMany();

  await prisma.clinic.create({
    data: {
      name: 'Dental AI Clinic',
      about:
        'Dental AI Clinic is a portfolio-ready dental practice demo that combines preventive care, restorative treatment, and AI-assisted patient support.',
      mission:
        'Showcase clear treatment planning, dependable appointment booking, and a modern AI-powered clinic experience under the Sheheryar Ali brand.',
      address: 'Office 12, Main Boulevard, Johar Town, Lahore, Pakistan',
      phone: '+92 342 8424576',
      whatsapp: '+92 310 2589624',
      email: 'sherrydev2480@gmail.com',
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
        name: 'Dr. Sheheryar Ali',
        specialty: 'Endodontics',
        bio: 'Specializes in root canal therapy and urgent pain management with microscope-assisted treatment.',
        photoUrl: 'https://images.unsplash.com/photo-1612531386530-97286d97c2d2?auto=format&fit=crop&w=800&q=80',
        calUserId: 202
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
