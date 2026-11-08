// Empty and furnished pairs from 73 E Patterson. The homepage carousel and
// /rooms both read this list.

const HOUSE = "73 E Patterson";
const HOUSE_URL = "https://leskohomes.com/73epatterson";

export const rooms = [
  {
    slug: "living-room",
    title: "Living room",
    h1: "Virtual staging a living room",
    description:
      "The living room at 73 E Patterson, empty and furnished from the same camera. A green sofa, jute rug, and round oak table sit on the floor at real size. The brick fireplace stays.",
    place: HOUSE,
    placeUrl: HOUSE_URL,
    before: "/examples/living-empty.webp",
    after: "/examples/living-after.webp",
    beforeAlt: "Empty living room at 73 E Patterson, same view as the furnished photo, with the brick fireplace and no sofa",
    afterAlt: "The same living room furnished with a green sofa, jute rug, and round wood table",
    afterWidth: 1448,
    afterHeight: 1086,
    paragraphs: [
      "Both photos are the living room at 73 E Patterson, from the same camera. The empty one has the brick fireplace, the arch, and the bare floor. The furnished one keeps that fireplace and that arch.",
      "A green sofa, a jute rug, and a round oak table sit on the floor at their real size. The leather stools in the set are at the kitchen island, not in this frame. The furniture in the photo does not come with the house.",
    ],
    pieces: [
      ["Green sofa", "In the furnished photo"],
      ["Jute rug", "In the furnished photo"],
      ["Round oak table", "In the furnished photo"],
      ["Leather stools", "At the kitchen island"],
    ],
  },
  {
    slug: "kitchen",
    title: "Kitchen",
    h1: "Virtual staging a kitchen",
    description:
      "Virtual staging of the kitchen at 73 E Patterson. The empty photo and the furnished one share the arch. A dining table, linen chairs, and a jute runner are set at real size.",
    place: HOUSE,
    placeUrl: HOUSE_URL,
    before: "/examples/kitchen-empty.webp",
    after: "/examples/kitchen-furnished.webp",
    beforeAlt: "Empty kitchen at 73 E Patterson, looking toward the arch, with no table",
    afterAlt: "The same kitchen with a dining table, chairs, and a rug",
    afterWidth: 1448,
    afterHeight: 1086,
    paragraphs: [
      "The kitchen at 73 E Patterson, shot toward the arch. The empty photo has the floor and the arch and no table. The furnished photo is that same view.",
      "A dining table, linen chairs, and a jute runner are set where the floor can hold them. Plants sit on the counter. Same camera, so the arch does not move.",
    ],
    pieces: [
      ["Dining table", "In the furnished photo"],
      ["Linen chairs", "In the furnished photo"],
      ["Jute runner", "In the furnished photo"],
      ["Counter plants", "On the counter"],
    ],
  },
  {
    slug: "bedroom-1",
    title: "Bedroom 1",
    h1: "Virtual staging a bedroom",
    description:
      "The first bedroom at 73 E Patterson, empty and furnished from the same spot. A wood bed, jute rug, desk, and dresser. The floor vent and the bathroom door stay.",
    place: HOUSE,
    placeUrl: HOUSE_URL,
    before: "/examples/bedroom1-empty.webp",
    after: "/examples/bedroom1-furnished.webp",
    beforeAlt: "Empty first bedroom at 73 E Patterson, same view as the furnished photo, with the floor vent and the bathroom door",
    afterAlt: "The same bedroom with a wood bed, jute rug, desk, and dresser",
    afterWidth: 1448,
    afterHeight: 1086,
    paragraphs: [
      "The first bedroom at 73 E Patterson. The empty photo shows the floor vent and the bathroom door. The furnished photo is the same corner, with a wood bed, a jute rug, a writing desk by the window, and an oak dresser.",
      "The bed is the size of a real bed, set on the floor rather than floated in the middle of the frame. The door and the vent are still where they were.",
    ],
    pieces: [
      ["Wood bed", "In the furnished photo"],
      ["Jute rug", "In the furnished photo"],
      ["Writing desk", "By the window"],
      ["Oak dresser", "In the furnished photo"],
    ],
  },
  {
    slug: "bedroom-2",
    title: "Bedroom 2",
    h1: "Virtual staging the second bedroom",
    description:
      "The second bedroom at 73 E Patterson. Two windows and a ceiling fan in both photos. An upholstered bed, rug, desk, and nightstands, at real size.",
    place: HOUSE,
    placeUrl: HOUSE_URL,
    before: "/examples/bedroom2-empty.webp",
    after: "/examples/bedroom2-furnished.webp",
    beforeAlt: "Empty second bedroom at 73 E Patterson, same two windows and ceiling fan, with a ladder still in the room",
    afterAlt: "The same bedroom with an upholstered bed, rug, desk, and nightstands",
    afterWidth: 1536,
    afterHeight: 1024,
    paragraphs: [
      "The second bedroom at 73 E Patterson. Both photos have the two windows and the ceiling fan. The empty one still has a ladder in the room. The furnished one has an upholstered bed, a patterned rug, a desk and chair at the windows, and nightstands.",
      "The camera did not move between the two. The bed lands where the floor is, at the size of that bed.",
    ],
    pieces: [
      ["Upholstered bed", "In the furnished photo"],
      ["Patterned rug", "In the furnished photo"],
      ["Desk and chair", "At the windows"],
      ["Nightstands", "In the furnished photo"],
    ],
  },
  {
    slug: "bedroom-3",
    title: "Bedroom 3",
    h1: "Virtual staging the third bedroom",
    description:
      "The third bedroom at 73 E Patterson, empty and furnished from the same camera. A twin bed, oak desk, and dresser. The window, door, and ceiling fan stay.",
    place: HOUSE,
    placeUrl: HOUSE_URL,
    before: "/examples/bedroom3-empty.webp",
    after: "/examples/bedroom3-furnished.webp",
    beforeAlt: "Empty third bedroom at 73 E Patterson, same window, door, and ceiling fan, with bare carpet",
    afterAlt: "The same bedroom with a twin bed, oak desk, and dresser",
    afterWidth: 1536,
    afterHeight: 1024,
    paragraphs: [
      "The third bedroom at 73 E Patterson. Bare carpet in the empty photo, with the window, the door, and the ceiling fan. The furnished photo keeps all three and adds a twin bed, an oak desk by the door, an oak dresser by the window, and framed prints.",
      "A twin is the piece that fits this room. It is set at that size, on the floor, from the same camera as the empty shot.",
    ],
    pieces: [
      ["Twin bed", "In the furnished photo"],
      ["Oak desk", "By the door"],
      ["Oak dresser", "By the window"],
      ["Framed prints", "On the walls"],
    ],
  },
];

export function roomBySlug(slug) {
  return rooms.find((room) => room.slug === slug) ?? null;
}

export function roomUrl(room) {
  return `https://furniturefinder.co/rooms/${room.slug}`;
}

export function roomMarkdown(room) {
  const lines = [
    `# ${room.h1}`,
    "",
    room.description,
    "",
    `Canonical: ${roomUrl(room)}`,
    "",
    `Place: [${room.place}](${room.placeUrl})`,
    "",
    `Empty: https://furniturefinder.co${room.before}`,
    "",
    `Furnished: https://furniturefinder.co${room.after}`,
    "",
  ];
  for (const paragraph of room.paragraphs) lines.push(paragraph, "");
  lines.push("## Pieces", "");
  for (const [name, note] of room.pieces) lines.push(`- **${name}.** ${note}`);
  lines.push("", "The other rooms are at https://furniturefinder.co/rooms.");
  lines.push("");
  return lines.join("\n");
}
