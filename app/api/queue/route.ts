import type { NextRequest } from "next/server";

const mockServices = [
  {
    id: "accounts",
    name: "Accounts",
    shortName: "A",
    active: true,
    accepting: true,
    averageServiceMinutes: 6,
    waiting: 4,
    currentlyServing: "A017",
    nextToken: "A018",
  },
  {
    id: "certificates",
    name: "Certificates",
    shortName: "C",
    active: true,
    accepting: true,
    averageServiceMinutes: 8,
    waiting: 2,
    currentlyServing: "C004",
    nextToken: "C005",
  },
  {
    id: "enquiries",
    name: "General Enquiries",
    shortName: "G",
    active: true,
    accepting: false,
    averageServiceMinutes: 5,
    waiting: 1,
    currentlyServing: "G012",
    nextToken: "G013",
  },
  {
    id: "scholarship",
    name: "Scholarship",
    shortName: "S",
    active: true,
    accepting: true,
    averageServiceMinutes: 10,
    waiting: 5,
    currentlyServing: "S010",
    nextToken: "S011",
  },
  {
    id: "bonafide",
    name: "Bonafide Certificate",
    shortName: "B",
    active: false,
    accepting: false,
    averageServiceMinutes: 7,
    waiting: 0,
    currentlyServing: "B000",
    nextToken: "B001",
  },
];

export async function GET(request: NextRequest) {
  const serviceFilter = new URL(request.url).searchParams.get("service");
  const filteredServices = serviceFilter
    ? mockServices.filter((service) => service.id === serviceFilter)
    : mockServices;

  return Response.json({
    generatedAt: new Date().toISOString(),
    totalWaiting: filteredServices.reduce((sum, service) => sum + service.waiting, 0),
    services: filteredServices,
    recommendations: [
      "Open the scholarship counter before 10:30 AM to reduce demand pressure.",
      "Keep certificate intake live while the accounts desk is busy.",
      "Move one staff member to general enquiries when the waiting line exceeds 3 students.",
    ],
  });
}
