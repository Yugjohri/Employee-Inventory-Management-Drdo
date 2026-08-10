import RequestsView from "../../components/requests/RequestsView";

export default function MyRequests() {
  return (
    <RequestsView
      mode="mine"
      title="My Requests"
      description="Repairs and new items you've asked IT for."
    />
  );
}
