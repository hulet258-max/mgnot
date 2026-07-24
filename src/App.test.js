import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";

jest.mock("./socket", () => ({
  socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: false },
}));

jest.mock(
  "react-router-dom",
  () => {
    const React = require("react");
    const anchor = ({ children, to, className }) => React.createElement("a", { href: to, className }, children);
    return {
      BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
      Routes: ({ children }) => React.Children.toArray(children)[0]?.props?.element || null,
      Route: () => null,
      Navigate: () => null,
      Link: anchor,
      useNavigate: () => jest.fn(),
      useLocation: () => ({ pathname: "/", search: "" }),
    };
  },
  { virtual: true }
);

const raffle = {
  id: "demo-phone",
  itemName: "Demo Smartphone",
  shortDescription: "A phone to win.",
  description: "Detailed phone description.",
  condition: "New",
  estimatedValue: 1000,
  ticketPrice: 25,
  ticketLimit: 100,
  status: "open",
  coverImageUrl: "https://example.com/phone.jpg",
  galleryImageUrls: ["https://example.com/phone.jpg", "https://example.com/phone-side.jpg"],
  specifications: ["128 GB"],
  reservedCount: 10,
  assignedCount: 10,
  availableCount: 90,
  drawAt: new Date(Date.now() + (6 * 60 * 60 * 1000)).toISOString(),
  provider: { name: "Demo Provider", phone: "+251 91 222 3333", location: "Addis Ababa" },
};

const raffleList = [
  raffle,
  { ...raffle, id: "demo-tv", itemName: "Demo TV" },
  { ...raffle, id: "demo-laptop", itemName: "Demo Laptop" },
  { ...raffle, id: "demo-fridge", itemName: "Demo Fridge" },
  { ...raffle, id: "demo-speaker", itemName: "Demo Speaker" },
];

beforeEach(() => {
  global.fetch = jest.fn(async (input) => {
    const url = String(input);
    if (url.includes("telegram-user")) {
      return { ok: true, json: async () => ({ success: true, user: { firstName: "Demo", username: "demo" } }) };
    }
    if (url.includes("raffle-tickets")) {
      return { ok: true, json: async () => ({ success: true, purchases: [] }) };
    }
    if (url.includes("/raffles/demo-phone/numbers")) {
      return { ok: true, json: async () => ({ success: true, numbers: [{ number: 1, status: "available" }, { number: 2, status: "taken" }] }) };
    }
    if (url.includes("raffle-winners")) {
      return { ok: true, json: async () => ({ success: true, winners: [{ ...raffle, id: "past-phone", status: "completed", winningNumber: 12, winner: { displayName: "Demo Winner", phone: "+251 91 000 0000" } }] }) };
    }
    return { ok: true, json: async () => ({ success: true, raffles: raffleList }) };
  });
});

afterEach(() => jest.restoreAllMocks());

const switchToEnglish = () => {
  const languageButton = screen.getByRole("button", { name: /ቋንቋ ይምረጡ/i });
  expect(languageButton).toHaveTextContent("አማ");
  fireEvent.click(languageButton);
  fireEvent.click(screen.getByRole("button", { name: /እንግሊዝኛ/i }));
};

test("renders the item raffle home page", async () => {
  render(<App />);
  switchToEnglish();
  expect(await screen.findByRole("heading", { name: /Demo Smartphone/i })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Details$/i })).toHaveLength(4);
  expect(await screen.findByRole("heading", { name: /Previous item winners/i })).toBeInTheDocument();
  expect(await screen.findByText(/Demo Winner/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Final draw/i).length).toBeGreaterThan(0);
  expect(screen.queryByRole("heading", { name: /Demo Speaker/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /See more/i }));
  expect(screen.getByRole("heading", { name: /Demo Speaker/i })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Details$/i })).toHaveLength(5);
});

test("shows Pay only while a number is selected and then opens payment", async () => {
  render(<App />);
  switchToEnglish();
  const itemButtons = await screen.findAllByRole("button", { name: /^Details$/i });
  fireEvent.click(itemButtons[0]);

  const availableNumber = await screen.findByRole("button", { name: /Number 1, available/i });
  expect(screen.getByAltText(/Demo Smartphone view 1/i)).toHaveAttribute("src", "https://example.com/phone.jpg");
  expect(screen.getByText(/Demo Provider.*\+251 91 222 3333.*Addis Ababa/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Next image/i }));
  expect(screen.getByAltText(/Demo Smartphone view 2/i)).toHaveAttribute("src", "https://example.com/phone-side.jpg");
  expect(screen.queryByRole("button", { name: /^Pay$/i })).not.toBeInTheDocument();
  fireEvent.click(availableNumber);
  expect(screen.getByRole("button", { name: /^Pay$/i })).toBeInTheDocument();

  fireEvent.click(availableNumber);
  expect(screen.queryByRole("button", { name: /^Pay$/i })).not.toBeInTheDocument();

  fireEvent.click(availableNumber);
  fireEvent.click(screen.getByRole("button", { name: /^Pay$/i }));

  expect(await screen.findByText(/Payment & receipt/i)).toBeInTheDocument();
  expect(screen.getByText("#1")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^Pay with Telebirr$/i })).toBeInTheDocument();
  expect(within(screen.getByRole("dialog")).getAllByText("25 Birr")).toHaveLength(1);
  expect(screen.getByLabelText(/Your phone number/i)).toBeRequired();
  expect(screen.getByText(/Pay the above amount/i).parentElement).toHaveTextContent("+251 91 000 0000");
  expect(screen.queryByRole("heading", { name: /Is this your lucky number/i })).not.toBeInTheDocument();
});
