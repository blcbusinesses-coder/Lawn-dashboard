import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | null = null

export function getMailer(): nodemailer.Transporter {
  if (!_transporter) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD environment variables are not set')
    }
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return _transporter
}

export const MAIL_FROM = `Gray Wolf Workers <${process.env.GMAIL_USER}>`
