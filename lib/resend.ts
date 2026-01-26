import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendConfirmationEmail(to: string, displayName: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
      to,
      subject: 'Demo Submission Confirmed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Demo Submission Confirmed</h2>
          <p>Hi ${displayName},</p>
          <p>Your demo was successfully submitted and is now in the review queue.</p>
          <p>You'll be notified once a curator has reviewed your submission.</p>
          <p>Thanks for sharing your music!</p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}
