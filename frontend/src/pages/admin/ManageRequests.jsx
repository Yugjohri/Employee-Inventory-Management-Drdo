import RequestsView from "../../components/requests/RequestsView";

export default function ManageRequests() {
  return (
    <RequestsView
      mode="manage"
      title="Requests"
      description="Repair and new-item requests raised by employees."
    />
  );
}
