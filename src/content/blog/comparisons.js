// Comparison posts for /blog/<slug>, and their .md mirrors for agents. Inline
// links are written [text](href). Prices are what the cited sources published
// in October 2026; check them again before changing a number.

const NAR_STAGING = { label: "NAR, 2025 Profile of Home Staging", url: "https://cms.nar.realtor/sites/default/files/2025-06/2025-profile-of-home-staging-report-06-26-2025.pdf" };
const ORVIONIS_PRICES = { label: "ORVIONIS, virtual staging prices at 9 companies (October 6, 2026)", url: "https://orvionis.com/guides/virtual-staging-cost" };
const CAMERA_PRICES = { label: "Real Estate Camera, virtual staging cost per photo (October 24, 2026)", url: "https://www.realestatecamera.app/guides/virtual-staging-cost-per-photo" };
const STAGING_COST = { label: "October, home staging cost guide citing HomeAdvisor and HomeGuide (October 28, 2026)", url: "https://www.october-ai.com/guides/home-staging-cost" };
const AB_723 = { label: "California AB 723, digitally altered images in real estate ads", url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB723" };
const BPC_10140 = { label: "California Business and Professions Code §10140.8", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=10140.8." };
const NAR_ETHICS = { label: "NAR, 2026 Code of Ethics, Article 12 and Standard of Practice 12-10", url: "https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/2026-code-of-ethics-standards-of-practice" };
const CRMLS = { label: "CRMLS, digitally altered image guidance and Rule 11.5.2", url: "https://kb.crmls.org/knowledgebase/digitally-altered-image-guidance-faqs/" };
const ARMLS = { label: "ARMLS, Rule 8.23, digitally altered media", url: "https://armls.com/digitally-altered-media" };
const DISCLOSE = {
  q: "Do I have to label a furnished listing photo?",
  a: "In California, a licensee advertising a property for sale does. AB 723 requires a statement on or next to the image and a way to see the original. MLS rules are separate and differ by board: some want a caption, some a watermark, some the original beside the staged photo. Check your MLS before you post.",
};

const TRY = "Try it on your own photo in the [free studio](/studio). Saving rooms and connecting your AI is $12 a month.";

export const comparisons = [
  {
    slug: "virtually-staged-photo-disclosure",
    kicker: "Disclosure",
    title: "Do you have to label a virtually staged listing photo?",
    metaTitle: "Virtually staged photos: what California AB 723 and your MLS require",
    description:
      "California AB 723, in effect since January 1, 2026, requires a label and the original photo when a licensee advertises a sale with a digitally altered image. MLS rules differ by board.",
    lede: "Virtual staging is allowed. California now requires a label and the original photo, and each MLS writes its own rule for how you show it.",
    published: "2026-11-08",
    keywords: ["AB 723", "virtually staged photo disclosure", "digitally altered listing photos", "MLS virtual staging rules", "virtual staging disclosure"],
    image: { src: "/examples/living-after.webp", alt: "A living room at 73 E Patterson with a green sofa, jute rug, and round wood table", width: 1448, height: 1086 },
    intro: [
      "Your broker and your MLS decide what a given listing needs. What follows is a reading of the published rules, so you can see the difference between California law and the photo rule on your own board.",
      "California's AB 723 took effect January 1, 2026. It added section 10140.8 to the Business and Professions Code. A real estate broker or salesperson, or a person acting for them, who uses a digitally altered image in an ad for the sale of real property has to say the image was altered and give people the original.",
      "There is no matching national MLS form. NAR's Code of Ethics requires a true picture in advertising, and Standard of Practice 12-10 extends that to images. Each MLS writes the photo rule, and two large boards already do it differently.",
    ],
    table: {
      caption: "The line in Business and Professions Code section 10140.8. Your MLS can ask for more.",
      head: ["The change", "Under AB 723", "What to post"],
      rows: [
        ["Furniture added or removed", "Altered", "A label, and the original photo"],
        ["Paint, flooring, landscaping, or the view changed", "Altered", "A label, and the original photo"],
        ["Straightened, cropped, or the exposure fixed", "Not altered", "The edited photo, on its own"],
        ["Brightened, sharpened, or color-corrected", "Not altered", "The edited photo, on its own"],
      ],
    },
    sections: [
      {
        h: "What California asks for",
        paragraphs: [
          "The statement has to be reasonably conspicuous, and it has to sit on the image or next to it. It has to say the image was altered, and it has to say where the original can be seen.",
          "That place is a public web page, a URL, or a QR code, and the page has to identify the original. On a website the licensee controls, the original also goes in the posting itself. A link to the original satisfies that, as long as the statement says so.",
          "The section is written for an advertisement for the sale of real property. A rental ad is outside that sentence. If the rental is in an MLS, the board's photo rule still applies.",
          "A label that works on a site you control: \"Virtually staged. Furniture was added. The unaltered photo is on this page.\"",
        ],
      },
      {
        h: "Adding a sofa counts. Straightening does not",
        list: [
          ["Furniture, fixtures, and appliances.", "Added, removed, or swapped."],
          ["Floors, walls, and paint.", "A new floor or a new color is a change to the property."],
          ["The outside.", "Landscape, hardscape, the facade, and floor plans."],
          ["What you can see past the house.", "Views through the windows, streetlights, utility poles, and the neighboring property."],
        ],
        paragraphs: [
          "Lighting, sharpening, white balance, color correction, angle, straightening, cropping, and exposure stay out of the definition, when they leave the property looking like itself. The straighten step in Furniture Finder is in that list. The sofa it places afterward is not, because the furniture was not in the room.",
        ],
      },
      {
        h: "Your MLS writes its own rule",
        list: [
          ["NAR.", "Article 12 requires a true picture in advertising. Standard of Practice 12-10 includes images, and it bars misleading ones. NAR does not publish one national \"virtually staged\" label for every board to copy."],
          ["CRMLS, California.", "Rule 11.5.2 asks for a label in the photo description, such as \"digitally altered\" or \"virtually staged,\" and the original photo immediately before or after the altered one."],
          ["ARMLS, Arizona.", "Rule 8.23 asks for the Flexmls \"Digitally Altered\" disclosure on the photo, with the original directly before or after it. A vendor's own watermark is not an approved substitute. The $200 fine started May 28, 2026, is waived through November 2026, and is enforced from December 2026."],
        ],
        paragraphs: [
          "Those two boards already disagree on the method. CRMLS uses the photo description. ARMLS wants its system disclosure on the photo. A watermark that satisfies one board can violate the other. Read the photo rule for the board you are uploading to.",
        ],
      },
      {
        h: "A pair of photos covers both",
        list: [
          ["Keep the empty original.", "You already have it if the furnished photo started from it."],
          ["Post them side by side.", "The furnished photo, then the empty one, or the other way around. CRMLS and ARMLS both want them next to each other."],
          ["Put the words where that site asks.", "On the image, in the caption, or in the remarks. If the board forbids words on the photo, use its checkbox or remarks field."],
          ["On your own website, include the original on the page.", "Or link to it, and say so next to the furnished photo."],
          ["Leave the room itself alone.", "Walls, windows, flooring, and the view should match the original. Furniture is the thing that changed."],
        ],
      },
      {
        h: "Where Furniture Finder fits",
        paragraphs: [
          "The studio starts from your photo, straightens it, and sets real pieces on the floor at their real size. The render should still be that room. The furnished photo is a digitally altered image anyway, because the furniture was added.",
          "Save the empty frame and the furnished one, and post them as a pair. [Try it on your own photo](/studio). Saving rooms and connecting your AI is $12 a month.",
        ],
        figure: {
          before: { src: "/examples/living-empty.webp", alt: "The empty living room at 73 E Patterson, with the brick fireplace and bare wood floor" },
          after: { src: "/examples/living-after.webp", alt: "The same living room with a green sofa, jute rug, round wood table, and stools" },
          caption: "The empty photo is the original. The furnished one is the altered image, and the two belong next to each other.",
        },
      },
    ],
    faq: [
      {
        q: "Does AB 723 allow virtual staging?",
        a: "Yes. Adding furniture stays legal when the ad has a statement on or next to the image and a way to see the original.",
      },
      {
        q: "Does straightening a listing photo need a label?",
        a: "Not under section 10140.8, when straightening is all you did. The exclusion also covers cropping, exposure, white balance, sharpening, and color correction, as long as the property still looks like itself.",
      },
      {
        q: "Who has to comply, the agent or the photographer?",
        a: "The statute names the broker, the salesperson, or a person acting for them. The person who posts the ad is the one the section addresses.",
      },
      {
        q: "Does this apply outside California?",
        a: "Section 10140.8 is California law, and it is written for sale advertising. NAR's true-picture duty applies to members in every state, and each MLS has its own photo rule. ARMLS in Arizona is one example.",
      },
      {
        q: "What about a website I control?",
        a: "For a California licensee advertising a sale, the original goes in the posting, or you link to a public page that identifies it. The statement on or next to the image has to say where that original is.",
      },
      {
        q: "Does a rental listing have to follow AB 723?",
        a: "The section says an advertisement for the sale of real property. A rental ad is outside that sentence. If the rental is in an MLS, follow that board's photo rule.",
      },
    ],
    sources: [BPC_10140, AB_723, NAR_ETHICS, CRMLS, ARMLS],
  },
  {
    slug: "furniture-finder-vs-virtual-staging",
    kicker: "Comparisons",
    title: "Virtual staging services vs Furniture Finder: $16 to $37 a photo, or $12 a month",
    metaTitle: "Virtual staging services vs Furniture Finder: cost, turnaround, and real furniture",
    description:
      "How a virtual staging service compares with Furniture Finder on price per listing, turnaround, the furniture itself, and scale, and when paying a designer is still the better choice.",
    lede: "A virtual staging service bills every photo and takes a day or two. Furniture Finder is a flat $12 a month, takes minutes, and every piece is something a buyer can actually go and buy.",
    published: "2026-11-07",
    keywords: ["virtual staging", "virtual staging services", "virtual staging cost", "virtual staging alternative", "real estate virtual staging"],
    image: { src: "/examples/living-after.webp", alt: "A living room at 73 E Patterson with a green sofa, jute rug, and round wood table", width: 1448, height: 1086 },
    intro: [
      "A virtual staging service is a designer who puts 3D furniture into your listing photo. You upload the empty room, pick a style, and get the staged photo back.",
      "Published prices in October 2026 ran $16 to $37 a photo from design services, with 24 to 48 hours to deliver and extra for a rush. A vacant listing usually needs four to six staged photos, so that is about $92 to $200 for each listing.",
      "Furniture Finder does the same job differently. You straighten the photo, pick real pieces, and set them on the floor at their real size. Your own AI does the final render. It is $12 a month for every room you do.",
    ],
    table: {
      caption: "Service prices are the ones design services published in October 2026.",
      head: ["", "Furniture Finder", "Virtual staging service"],
      rows: [
        ["Price", "$12 a month, every room", "$16 to $37 a photo, for every listing"],
        ["Turnaround", "Minutes, while you work", "24 to 48 hours. A rush costs more"],
        ["The furniture", "Real listings, with a seller, a price, and dimensions", "A 3D library the designer picks from"],
        ["Size", "Set from the room, using the ceiling or a door", "Whatever looks right to the designer"],
        ["Changes", "Move the piece and save again", "A revision request, and another wait"],
        ["Who does the work", "You place the pieces. Your AI renders", "The designer does all of it"],
      ],
    },
    sections: [
      {
        h: "What the money goes to",
        paragraphs: [
          "A service bills by the photo, so the cost grows with every listing. Five photos at $24 is $120 for one listing. Three listings a month is $360.",
          "Furniture Finder is the same $12 whether you furnish one room or thirty. The render runs on the AI model you already pay for, so the site doesn't spend image credits on it, and doesn't bill you for them.",
        ],
      },
      {
        h: "Pieces a buyer can buy",
        paragraphs: [
          "A staged photo invites one question at the showing: where is that sofa from? With a service, the honest answer is a 3D model library.",
          "Every piece in Furniture Finder is a real listing, with its seller, a quoted price, its width, height, and depth, and photos from more than one side. If a buyer loves the room, the room can be bought. [Browse the pieces](/pick).",
        ],
        figure: {
          before: { src: "/examples/living-empty.webp", alt: "The empty living room at 73 E Patterson, with the brick fireplace and bare wood floor" },
          after: { src: "/examples/living-after.webp", alt: "The same living room with a green sofa, jute rug, round wood table, and stools" },
          caption: "The living room at 73 E Patterson, empty and furnished, from the same camera.",
        },
      },
      {
        h: "Furniture at the size of the room",
        paragraphs: [
          "A designer sizes furniture by eye. Usually that's close enough. Sometimes it's a queen bed shrunk to fit a small bedroom, and the buyer finds out at the showing.",
          "Furniture Finder sets the scale from the room itself, using something of known height like the ceiling or a door, and every piece goes on the floor at its real size. If a king bed doesn't fit, the photo shows it doesn't.",
        ],
      },
      {
        h: "When a staging service is the better choice",
        list: [
          ["You don't want to do it yourself.", "A service is hands-off. Furniture Finder is quick, but you place the pieces."],
          ["The room is still full.", "Services remove furniture before they stage. Furniture Finder furnishes empty rooms. It doesn't empty full ones."],
          ["You want styling, not just furniture.", "Art, plants, throw pillows, and a designer's eye across 25 photos."],
          ["You have no AI app for the render.", "The final render runs on your own model, through an app that supports MCP, like Claude Code, Cursor, or Codex."],
        ],
      },
      {
        h: "Either way, label the photo",
        paragraphs: [
          "A furnished photo of an empty room is a digitally altered photo, whoever made it. California's AB 723 asks for a statement on or next to the image and a way to see the original, and each MLS writes its own version of that. The sources and the differences are in [Do you have to label a virtually staged listing photo?](/blog/virtually-staged-photo-disclosure).",
          TRY,
        ],
      },
    ],
    faq: [
      {
        q: "Is Furniture Finder virtual staging?",
        a: "Yes, with real furniture. It puts real, buyable pieces into a photo of an empty room, at their real size, and your AI renders the result. It doesn't invent furniture or redesign the room.",
      },
      {
        q: "How long does a room take?",
        a: "A few minutes. The photo is straightened automatically, or you drag four corners. Then you pick pieces and set them on the floor. The render takes as long as your AI model takes.",
      },
      {
        q: "Can it stage a room that still has furniture in it?",
        a: "Not yet. Furniture Finder furnishes empty rooms. A service that removes furniture first is the better fit for an occupied home.",
      },
      DISCLOSE,
    ],
    sources: [ORVIONIS_PRICES, CAMERA_PRICES, AB_723],
  },
  {
    slug: "furniture-finder-vs-ai-staging-apps",
    kicker: "Comparisons",
    title: "AI staging apps vs Furniture Finder: invented furniture, or pieces you can buy",
    metaTitle: "AI virtual staging apps vs Furniture Finder: real furniture at real size",
    description:
      "AI staging apps are cheaper per photo. Here is what they make up, the furniture, its size, and sometimes the room, and when Furniture Finder's real pieces at true scale are worth $12 a month.",
    lede: "An AI staging app is the cheapest way to fill an empty photo. It is also guessing: the sofa doesn't exist, its size is a guess, and the walls and windows can come back changed.",
    published: "2026-11-07",
    keywords: ["AI virtual staging", "AI staging app", "AI home staging", "virtual staging AI", "AI staging alternative"],
    image: { src: "/examples/bedroom3-furnished.webp", alt: "A furnished bedroom at 73 E Patterson with a twin bed, oak desk, and dresser", width: 1536, height: 1024 },
    intro: [
      "An AI staging app takes your empty room photo and a style, and returns it furnished in seconds. In October 2026 they cost from under $1 to about $5 a photo, and less if you use every credit in a subscription.",
      "That makes them cheaper per photo than Furniture Finder. What you get for the money is different, though. The app's model draws furniture that looks right. Furniture Finder places furniture that is real.",
    ],
    table: {
      caption: "App prices are the ones vendors published in October 2026.",
      head: ["", "Furniture Finder", "AI staging app"],
      rows: [
        ["Price", "$12 a month. The render runs on your own AI", "Under $1 to about $5 a photo"],
        ["The furniture", "Real listings you can buy", "Furniture the model invented"],
        ["Size", "Set from the room, using the ceiling or a door", "The model's guess"],
        ["The room", "Your photo, with its walls, window, and floor", "Can come back with walls, floors, or windows changed"],
        ["Two angles of one room", "The same pieces, at the same size", "The layout can drift between photos"],
        ["Speed", "Minutes. You place the pieces", "Seconds. One click"],
      ],
    },
    sections: [
      {
        h: "The sofa doesn't exist",
        paragraphs: [
          "A generated sofa can look perfect and still be a sofa nobody makes. That matters the moment a buyer or a tenant asks where it's from, or tries to furnish the room the way the photo showed it.",
          "Every piece in Furniture Finder is a real listing, with a seller, a quoted price, dimensions, and photos from more than one side. [See the catalog](/pick).",
        ],
      },
      {
        h: "Its size is a guess",
        paragraphs: [
          "An image model has no idea how wide your bedroom is. It sizes the bed so the picture looks balanced, which is how small rooms end up with furniture that couldn't fit through the door.",
          "Furniture Finder takes the scale from the room, using something of known height like the ceiling or a door. Each piece is set on the floor at its real width, height, and depth.",
        ],
        figure: {
          before: { src: "/examples/bedroom3-empty.webp", alt: "An empty third bedroom at 73 E Patterson, with a window, a door, a ceiling fan, and bare carpet" },
          after: { src: "/examples/bedroom3-furnished.webp", alt: "The same bedroom with a twin bed, oak desk, and dresser" },
          caption: "A small bedroom with a twin bed, a desk, and a dresser that fit it, from the same camera.",
        },
      },
      {
        h: "The room can change too",
        paragraphs: [
          "Generative models repaint the whole image. Walls shift, floors change color, windows move. Some apps have a mode that tries to keep the architecture, but that is the problem they're working around.",
          "It is also a disclosure problem. California's AB 723 treats a photo changed to add, remove, or change elements as digitally altered, and requires a label and a way to see the original. A room whose window moved is a harder photo to defend. The rule, and how MLS boards differ, is in [Do you have to label a virtually staged listing photo?](/blog/virtually-staged-photo-disclosure).",
          "Furniture Finder starts from your photo. The mockup is the room as shot, straightened, with the pieces set on the floor. Your AI renders from that mockup, so you can check the render against it.",
        ],
      },
      {
        h: "When an AI staging app is the better choice",
        list: [
          ["You need dozens of rooms today.", "One click a photo is faster than placing pieces."],
          ["The cheapest photo wins.", "Under a dollar a photo is hard to beat."],
          ["You want to browse styles.", "Apps are good at showing a room five ways in a minute."],
          ["The room still has furniture in it.", "Many apps can empty a room first. Furniture Finder furnishes empty rooms."],
        ],
      },
      {
        h: "Try it on one room",
        paragraphs: [TRY],
      },
    ],
    faq: [
      {
        q: "Does Furniture Finder use AI?",
        a: "For the final render, yes, and it's your own model. Furniture Finder straightens the photo and places real pieces at size. The saved room goes to your AI app over MCP, which renders it photoreal.",
      },
      {
        q: "Why pay $12 a month when an AI app costs less per photo?",
        a: "For furniture that exists, at the size it really is, in the room as it was shot. If the cheapest photo is all you need, an AI app is cheaper.",
      },
      {
        q: "Which AI apps work with it?",
        a: "Any app that can connect to an MCP server with a key, including Claude Code, Cursor, and Codex. You make the key on your dashboard.",
      },
      DISCLOSE,
    ],
    sources: [CAMERA_PRICES, ORVIONIS_PRICES, AB_723],
  },
  {
    slug: "furniture-finder-vs-home-staging",
    kicker: "Comparisons",
    title: "Home staging vs Furniture Finder: $1,500 and a moving truck, or $12 a month",
    metaTitle: "Home staging cost vs virtual staging with real furniture",
    description:
      "What a staging company costs for a vacant home, what it does that a photo can't, and how Furniture Finder furnishes the listing photos with real pieces at real size for $12 a month.",
    lede: "Agents who hired a staging service spent a median of $1,500, and a vacant home keeps paying furniture rent every month it sits. For the photos, there's a cheaper way.",
    published: "2026-11-07",
    keywords: ["home staging cost", "virtual staging vs physical staging", "home staging", "staging a vacant home", "staging alternative"],
    image: { src: "/examples/kitchen-furnished.webp", alt: "A kitchen at 73 E Patterson with a dining table, chairs, and a rug", width: 1448, height: 1086 },
    intro: [
      "A staging company brings real furniture into the house, sets it up for the photos and the showings, and takes it away when the home sells.",
      "It works. In NAR's 2025 survey, 83 percent of buyers' agents said staging made it easier for a buyer to picture the home as theirs. It also costs real money. Agents who used a staging service spent a median of $1,500, and a vacant home is usually billed in 30-day terms, with furniture rent of about $500 to $600 a room each month.",
      "Furniture Finder furnishes the listing photos instead of the house. Real pieces, at their real size, for $12 a month.",
    ],
    table: {
      caption: "Staging costs from NAR's 2025 Profile of Home Staging and HomeAdvisor's 2026 cost guide.",
      head: ["", "Furniture Finder", "A staging company"],
      rows: [
        ["Price", "$12 a month", "A median of $1,500, plus monthly rent on a vacant home"],
        ["Time", "Minutes a room", "Days to schedule, a day to install, a reshoot after"],
        ["The furniture", "Real listings you can buy", "Whatever the stager has in the warehouse"],
        ["The photo", "The listing photo you already have", "A second shoot of the furnished house"],
        ["The showing", "The rooms are empty in person", "The rooms are furnished in person"],
      ],
    },
    sections: [
      {
        h: "Where the staging bill goes",
        paragraphs: [
          "For a vacant home, most of the bill is rented furniture. Stagers usually work in 30-day terms, and each month the house sits adds more rent. A listing that takes three months pays for three.",
          "Then there's the reshoot. The photos taken before the furniture arrived are useless, so the house is photographed again.",
        ],
      },
      {
        h: "What the photos need",
        paragraphs: [
          "Most buyers see the house first on a phone. The living room, the primary bedroom, and the dining room are the rooms stagers furnish most, 91, 83, and 69 percent of the time in NAR's survey. Those are the photos that need furniture most.",
          "Furniture Finder starts from the photo you already took. Straighten it, set real pieces on the floor at their real size, and let your AI render it. [Here's how to shoot the room so it works](/blog/real-estate-photography-tips).",
        ],
        figure: {
          before: { src: "/examples/kitchen-empty.webp", alt: "The empty kitchen at 73 E Patterson, looking toward the arch, with no table" },
          after: { src: "/examples/kitchen-furnished.webp", alt: "The same kitchen with a dining table, chairs, and a rug" },
          caption: "The kitchen at 73 E Patterson, from the same camera, empty and furnished.",
        },
      },
      {
        h: "When a staging company is the better choice",
        list: [
          ["Buyers will walk through it.", "A furnished room in person does what no photo can. An empty house can feel smaller than its photos."],
          ["It's a luxury listing.", "At the top of the market, buyers expect the house itself to be finished."],
          ["You're holding an open house.", "People spend time in the rooms, not on a screen."],
        ],
        paragraphs: [
          "There's a middle path. Stage the living room for the showings, and furnish the photos of the other rooms. In NAR's survey, agents who staged a home themselves spent a median of $500.",
        ],
      },
      {
        h: "Label the photos",
        paragraphs: [
          "A furnished photo of an empty room needs a label in California, and the original beside it on the boards that require one. Buyers who arrive at an empty house should already know it's empty. The rules are in [Do you have to label a virtually staged listing photo?](/blog/virtually-staged-photo-disclosure).",
          TRY,
        ],
      },
    ],
    faq: [
      {
        q: "Does home staging help a house sell?",
        a: "Agents think so. In NAR's 2025 survey, 83 percent of buyers' agents said staging made it easier for a buyer to visualize the home, and 17 percent said it raised offers by 1 to 5 percent. 41 percent said it made no difference to the price.",
      },
      {
        q: "How much does it cost to stage a vacant house?",
        a: "Agents who used a staging service spent a median of $1,500 in NAR's 2025 survey. HomeAdvisor puts furniture rent at about $500 to $600 a room each month, usually in 30-day terms.",
      },
      {
        q: "Can I use Furniture Finder and a stager together?",
        a: "Yes. Stage the rooms buyers will spend time in, and furnish the photos of the rest.",
      },
      DISCLOSE,
    ],
    sources: [NAR_STAGING, STAGING_COST, AB_723],
  },
  {
    slug: "furniture-finder-vs-photoshop",
    kicker: "Comparisons",
    title: "Virtual staging in Photoshop vs Furniture Finder: an hour of masking, or a few minutes",
    metaTitle: "How to virtually stage a room in Photoshop, and the faster way",
    description:
      "What it takes to furnish a listing photo in Photoshop, from straightening the walls to matching the light, and how Furniture Finder does the same steps with real pieces at real size.",
    lede: "You can furnish a room in Photoshop. It takes a cutout at the right angle, a perspective fix, scale by eye, masking, shadows, and an hour. Here's each step, and the shortcut.",
    published: "2026-11-07",
    keywords: ["virtual staging photoshop", "how to virtually stage in photoshop", "add furniture to photo", "photoshop real estate photo", "furnish a room photo"],
    image: { src: "/examples/bedroom1-furnished.webp", alt: "A bedroom at 73 E Patterson with a wood bed, jute rug, desk, and dresser", width: 1448, height: 1086 },
    intro: [
      "Photoshop can furnish any room. It's what most virtual stagers did before AI, and it gives you total control over every pixel.",
      "It also takes about an hour a room for someone who knows what they're doing. Most of that hour goes to the same five steps, and Furniture Finder does each of them for you.",
    ],
    table: {
      caption: "The same steps, in both tools.",
      head: ["Step", "Furniture Finder", "Photoshop"],
      rows: [
        ["Straighten the walls", "Automatic, or drag four corners", "Lens correction, or a transform by hand"],
        ["Find the furniture", "Real listings, photographed from more than one side", "A cutout you go and find, at roughly the right angle"],
        ["Get the size right", "Set from the room, using the ceiling or a door", "By eye"],
        ["Put it on the floor", "Placed on the floor plane", "Perspective warp and masking"],
        ["Light and shadow", "Your AI renders them from the mockup", "Painted by hand"],
      ],
    },
    sections: [
      {
        h: "Straighten the walls first",
        paragraphs: [
          "Listing photos are wide shots, and wide shots make the walls lean in. Photoshop can fix it with lens correction or Camera Raw's Upright, or a transform by hand. Either way, you crop the edges.",
          "Furniture Finder straightens the photo when you open it, and keeps the edges by filling them. If it gets one wrong, drag the four corners of the back wall into a rectangle. [Try the straighten tool](/straighten).",
        ],
      },
      {
        h: "Find a piece at the right angle",
        paragraphs: [
          "This is the slow part in Photoshop. A sofa photographed from the front looks pasted on in a room shot from the corner. You need a cutout from the angle your camera saw, and product photos rarely come that way.",
          "Every Furniture Finder piece comes with photos from more than one side, and the studio picks the view that matches the room as you turn it.",
        ],
        figure: {
          before: { src: "/examples/bedroom1-empty.webp", alt: "The empty first bedroom at 73 E Patterson, with the floor vent and the bathroom door" },
          after: { src: "/examples/bedroom1-furnished.webp", alt: "The same bedroom with a wood bed, jute rug, desk, and dresser" },
          caption: "The first bedroom at 73 E Patterson, empty and furnished.",
        },
      },
      {
        h: "Scale, floor, and shadows",
        paragraphs: [
          "In Photoshop you scale by eye, warp the piece onto the floor, mask it around anything in front of it, and paint the shadows it would cast. Get the scale wrong and the room looks like a dollhouse.",
          "Furniture Finder takes the scale from the room, from the ceiling or a door, and sets each piece on the floor plane. The light, the shadows, and the contact with the floor are left to your AI's render, which works from the mockup.",
        ],
      },
      {
        h: "When Photoshop is the better choice",
        list: [
          ["You want control of every pixel.", "Nothing beats it for a hero shot you'll retouch for an hour."],
          ["The fix isn't furniture.", "Blown windows, a cord on the floor, the wrong paint color."],
          ["Finishing a render.", "Render the room with Furniture Finder, then touch up the details in Photoshop. They work well together."],
        ],
      },
      {
        h: "Try it on the same room",
        paragraphs: ["Take the photo you'd open in Photoshop and try it in the [free studio](/studio) first. Saving rooms and connecting your AI is $12 a month."],
      },
    ],
    faq: [
      {
        q: "Can I virtually stage a room in Photoshop?",
        a: "Yes. Straighten the walls, find furniture cutouts at the camera's angle, scale and warp them onto the floor, mask them, and paint the shadows. Expect about an hour a room.",
      },
      {
        q: "Where do I get furniture to put in a photo?",
        a: "In Photoshop, from cutouts you find yourself. In Furniture Finder, from a catalog of real listings, each with its seller, price, dimensions, and photos from more than one side.",
      },
      {
        q: "Do I need Photoshop to use Furniture Finder?",
        a: "No. It runs in the browser. The final render runs on your own AI model.",
      },
      DISCLOSE,
    ],
    sources: [AB_723],
  },
];

export const comparisonBySlug = (slug) => comparisons.find((post) => post.slug === slug) ?? null;

const SITE_URL = "https://furniturefinder.co";
const absoluteLinks = (text) => text.replace(/\]\(\//g, `](${SITE_URL}/`);

export function comparisonMarkdown(post, publishedLabel) {
  const lines = [
    `# ${post.title}`,
    "",
    `By [Brian Lesko](https://brianlesko.com), creator of Furniture Finder. Published ${publishedLabel}.`,
    "",
    `Canonical: ${SITE_URL}/blog/${post.slug}`,
    "",
    ...post.intro.flatMap((text) => [absoluteLinks(text), ""]),
    `| ${post.table.head.join(" | ")} |`,
    `| ${post.table.head.map(() => "---").join(" | ")} |`,
    ...post.table.rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    post.table.caption,
    "",
  ];
  for (const section of post.sections) {
    lines.push(`## ${section.h}`, "");
    if (section.list) lines.push(...section.list.map(([lead, rest]) => `- **${lead}** ${absoluteLinks(rest)}`), "");
    for (const text of section.paragraphs ?? []) lines.push(absoluteLinks(text), "");
  }
  lines.push("## Questions", "");
  for (const item of post.faq) lines.push(`**${item.q}**`, item.a, "");
  lines.push("## Sources", "", ...post.sources.map((source) => `- [${source.label}](${source.url})`), "");
  return lines.join("\n");
}
