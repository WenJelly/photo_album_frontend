import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AuthDialog } from "@/components/AuthDialog"

describe("AuthDialog", () => {
  it("shows the login state by default with forgot-password entry", () => {
    render(<AuthDialog open onClose={() => {}} />)

    expect(screen.getByRole("dialog", { name: /\u767b\u5f55/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/\u90ae\u7bb1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^\u5bc6\u7801$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/\u786e\u8ba4\u5bc6\u7801/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /\u5fd8\u8bb0\u5bc6\u7801\?/i })
    ).toBeInTheDocument()
  })

  it("validates required fields in login mode", async () => {
    const user = userEvent.setup()

    render(<AuthDialog open onClose={() => {}} />)
    await user.click(screen.getByRole("button", { name: /^\u767b\u5f55$/i }))

    expect(screen.getByText(/\u8bf7\u8f93\u5165\u90ae\u7bb1/i)).toBeInTheDocument()
    expect(screen.getByText(/\u8bf7\u8f93\u5165\u5bc6\u7801/i)).toBeInTheDocument()
  })

  it("switches to register mode and validates confirm password", async () => {
    const user = userEvent.setup()

    render(<AuthDialog open onClose={() => {}} />)
    await user.click(screen.getByRole("button", { name: /\u6ce8\u518c/i }))

    expect(screen.getByRole("dialog", { name: /\u6ce8\u518c/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/\u786e\u8ba4\u5bc6\u7801/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/\u90ae\u7bb1/i), "hello@example.com")
    await user.type(screen.getByLabelText(/^\u5bc6\u7801$/i), "secret123")
    await user.type(screen.getByLabelText(/\u786e\u8ba4\u5bc6\u7801/i), "secret456")
    await user.click(screen.getByRole("button", { name: /^\u6ce8\u518c$/i }))

    expect(
      screen.getByText(/\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4/i)
    ).toBeInTheDocument()
  })

  it("closes after fake login succeeds", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<AuthDialog open onClose={onClose} />)

    await user.type(screen.getByLabelText(/\u90ae\u7bb1/i), "hello@example.com")
    await user.type(screen.getByLabelText(/^\u5bc6\u7801$/i), "secret123")
    await user.click(screen.getByRole("button", { name: /^\u767b\u5f55$/i }))

    expect(screen.getByRole("button", { name: /\u767b\u5f55\u4e2d/i })).toBeDisabled()

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    }, { timeout: 1200 })
  })

  it("shows a success state after fake registration and can switch back to login", async () => {
    const user = userEvent.setup()

    render(<AuthDialog open onClose={() => {}} />)
    await user.click(screen.getByRole("button", { name: /\u6ce8\u518c/i }))
    await user.type(screen.getByLabelText(/\u90ae\u7bb1/i), "hello@example.com")
    await user.type(screen.getByLabelText(/^\u5bc6\u7801$/i), "secret123")
    await user.type(screen.getByLabelText(/\u786e\u8ba4\u5bc6\u7801/i), "secret123")
    await user.click(screen.getByRole("button", { name: /^\u6ce8\u518c$/i }))

    expect(
      await screen.findByRole("dialog", { name: /\u6ce8\u518c\u6210\u529f/i })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /\u53bb\u767b\u5f55/i }))

    expect(screen.getByRole("dialog", { name: /\u767b\u5f55/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /\u5fd8\u8bb0\u5bc6\u7801\?/i })
    ).toBeInTheDocument()
  })
})
