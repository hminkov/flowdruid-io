import type { Request, Response } from 'express';

export function slackEventsHandler(req: Request, res: Response) {
  // Handle Slack URL verification challenge
  if (req.body?.type === 'url_verification') {
    res.json({ challenge: req.body.challenge });
    return;
  }

  // TODO: Add event handling as needed
  res.sendStatus(200);
}
