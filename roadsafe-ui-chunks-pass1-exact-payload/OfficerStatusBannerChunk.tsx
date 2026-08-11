interface Props {
  error: string;
  message: string;
}

export default function OfficerStatusBannerChunk({
  error,
  message,
}: Props) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-md border px-3 py-2.5 text-[10px] leading-5 ${
        error
          ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
          : "border-[#494949] bg-[#303030] text-[#c4c4c4]"
      }`}
    >
      {error || message}
    </div>
  );
}
