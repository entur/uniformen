import { FacebookIcon } from "../components/icons/FacebookIcon";
import { InstagramIcon } from "../components/icons/InstagramIcon";
import { LinkedInIcon } from "../components/icons/LinkedInIcon";

export function Footer({ contrast }: { contrast?: boolean }) {
  return (
    <footer id="footer" class={`uniformen-footer${contrast ? " uniformen-contrast" : ""}`}>
      <div class="uniformen-footer__inner">
        <section class="uniformen-footer__text">
          © {new Date().getFullYear()} Entur AS | <a href="https://www.entur.no/">Entur.no</a>
        </section>
        <section class="uniformen-footer__social-media">
          <a
            href="https://www.facebook.com/entur.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
          >
            <FacebookIcon />
          </a>
          <a
            href="https://www.instagram.com/entur_as/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>
          <a
            href="https://www.linkedin.com/company/entur-as/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <LinkedInIcon />
          </a>
        </section>
      </div>
    </footer>
  );
}
