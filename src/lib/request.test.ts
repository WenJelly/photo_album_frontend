import { parseApiJsonPayload, stringifyApiJsonPayload } from "./request"

describe("request JSON helpers", () => {
  it("keeps outgoing id-like fields as strings", () => {
    expect(
      stringifyApiJsonPayload({
        id: "101",
        userId: "202",
        reviewerId: "303",
        other: "404",
      }),
    ).toBe('{"id":"101","userId":"202","reviewerId":"303","other":"404"}')
  })

  it("protects large integer ids in incoming payloads", () => {
    expect(
      parseApiJsonPayload('{"id":12345678901234567,"userId":76543210987654321,"reviewerId":99999999999999999}'),
    ).toEqual({
      id: "12345678901234567",
      userId: "76543210987654321",
      reviewerId: "99999999999999999",
    })
  })
})
