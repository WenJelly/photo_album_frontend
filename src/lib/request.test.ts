import { parseApiJsonPayload, stringifyApiJsonPayload } from "@/lib/request"

describe("parseApiJsonPayload", () => {
  test("preserves large integer ids as strings", () => {
    expect(
      parseApiJsonPayload(
        '{"code":200,"data":{"id":1921565896585154562,"userId":1921565896585154563,"reviewerId":12}}',
      ),
    ).toEqual({
      code: 200,
      data: {
        id: "1921565896585154562",
        userId: "1921565896585154563",
        reviewerId: 12,
      },
    })
  })
})

describe("stringifyApiJsonPayload", () => {
  test("serializes numeric string ids as JSON numbers", () => {
    expect(
      stringifyApiJsonPayload({
        id: "1921565896585154562",
        userId: "1921565896585154563",
        reviewerId: "12",
        reviewStatus: 2,
      }),
    ).toBe('{"id":1921565896585154562,"userId":1921565896585154563,"reviewerId":12,"reviewStatus":2}')
  })
})
